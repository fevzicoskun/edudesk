import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Public paths ─────────────────────────────────────────────
const PUBLIC_PATHS = ['/', '/login', '/kayit', '/veli', '/yoklama-yazdir', '/onboarding', '/api/inngest', '/gizlilik', '/kullanim-kosullari', '/sifremi-unuttum', '/auth/callback']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// ─── Nonce ───────────────────────────────────────────────────
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co'
  // style-src 'unsafe-inline': React inline style={{ }} props HTML style="" attribute'una dönüşür.
  // style attribute'ları için nonce desteği yok (sadece <style> tag'leri için var).
  // Kaldırmak için tüm dinamik style prop'larının CSS variable + class bazlı yaklaşıma taşınması gerekir.
  // Risk düşük: img-src ve connect-src kısıtlamaları CSS exfiltration vektörlerini kapatır.
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl} wss://*.supabase.co https://*.upstash.io`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

// ─── Rate limiting ────────────────────────────────────────────
// RATE_LIMIT_FAIL_MODE=closed → Redis down ise hassas endpoint'leri reddet (default)
// RATE_LIMIT_FAIL_MODE=open   → Redis down ise geçir (availability öncelikli)
const FAIL_CLOSED = process.env.RATE_LIMIT_FAIL_MODE !== 'open'

type RateLimiter = (key: string, limit: number) => Promise<boolean>
let redisLimiter: RateLimiter | null = null
let redisInitialized = false

async function getRedisLimiter(): Promise<RateLimiter | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    const { Redis } = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    // Her endpoint kendi sınırına sahip — key prefix'e göre seçilir
    const limiters: Record<string, InstanceType<typeof Ratelimit>> = {
      'kayit:':      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,  '60 s'), prefix: 'rl:kayit' }),
      'onboarding:': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  '60 s'), prefix: 'rl:onboarding' }),
      'login:':      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:login' }),
      'reset:':      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,  '60 s'), prefix: 'rl:reset' }),
      'api:':        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s'), prefix: 'rl:api' }),
      'public:':     new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), prefix: 'rl:public' }),
    }
    return async (key, _limit) => {
      const prefix = Object.keys(limiters).find(p => key.startsWith(p)) ?? 'public:'
      const { success } = await limiters[prefix].limit(key)
      return success
    }
  } catch (e) {
    console.error('[rate-limit] Redis bağlantısı kurulamadı:', e)
    return null
  }
}

const redisLimiterPromise = getRedisLimiter().then(l => {
  redisLimiter = l
  redisInitialized = true
  if (!l && process.env.NODE_ENV === 'production') {
    console.warn('[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN tanımlı değil. Hassas endpoint\'ler fail-closed modunda çalışır.')
  }
  return l
})
void redisLimiterPromise

// Sadece development ortamında in-memory fallback — serverless'ta instance başına ayrı olduğu için production'da güvenilmez
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function inMemoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) { rateLimitMap.set(key, { count: 1, resetAt: now + windowMs }); return true }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

/**
 * isSensitive=true → Redis down ise FAIL_CLOSED modunda reddet
 * isSensitive=false → Redis down ise izin ver (public read endpoint'leri)
 */
async function checkRateLimit(key: string, limit: number, windowMs: number, isSensitive = false): Promise<boolean> {
  if (redisLimiter) return redisLimiter(key, limit)

  // Development: in-memory fallback
  if (process.env.NODE_ENV === 'development') return inMemoryLimit(key, limit, windowMs)

  // Production, Redis yok/down
  if (!redisInitialized) {
    // Init henüz tamamlanmadı — başlatılana kadar bekle (max 1sn)
    await Promise.race([redisLimiterPromise, new Promise(r => setTimeout(r, 1000))])
    const limiter = redisLimiter as RateLimiter | null
    if (limiter) return limiter(key, limit)
  }

  // Redis env var hiç tanımlı değil veya bağlantı başarısız
  if (isSensitive && FAIL_CLOSED) {
    console.error(`[rate-limit] Redis yok, hassas endpoint reddediliyor (fail-closed): ${key}`)
    return false
  }
  return true
}

// ─── Middleware ───────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // Rate limits
  if (pathname === '/login' && request.method === 'POST') {
    if (!(await checkRateLimit(`login:${ip}`, 10, 60_000, true))) {
      return new NextResponse('Çok fazla istek. Lütfen bekleyin.', { status: 429 })
    }
  }
  // Okul katılım formu — kaba kuvvet saldırısına karşı hassas sınır
  // /onboarding POST = okul kodu denemeleri (5/dk/IP, fail-closed)
  if (pathname === '/onboarding' && request.method === 'POST') {
    if (!(await checkRateLimit(`onboarding:${ip}`, 5, 60_000, true))) {
      return new NextResponse('Çok fazla deneme. Lütfen bekleyin.', { status: 429 })
    }
  }
  // /kayit POST = başvuru formu e-posta gönderir — spam koruması
  if (pathname === '/kayit' && request.method === 'POST') {
    if (!(await checkRateLimit(`kayit:${ip}`, 3, 60_000, true))) {
      return new NextResponse('Çok fazla istek. Lütfen bekleyin.', { status: 429 })
    }
  }
  // /sifremi-unuttum POST = şifre sıfırlama e-posta talebi — brute-force koruması
  if (pathname === '/sifremi-unuttum' && request.method === 'POST') {
    if (!(await checkRateLimit(`reset:${ip}`, 3, 60_000, true))) {
      return new NextResponse('Çok fazla istek. Lütfen bekleyin.', { status: 429 })
    }
  }
  if (pathname.startsWith('/api/') && pathname !== '/api/health' && pathname !== '/api/ready') {
    if (!(await checkRateLimit(`api:${ip}`, 30, 60_000, true))) {
      return new NextResponse('Çok fazla istek.', { status: 429 })
    }
  }
  if (isPublicPath(pathname) && pathname !== '/login') {
    if (!(await checkRateLimit(`public:${ip}`, 60, 60_000, false))) {
      return new NextResponse('Çok fazla istek.', { status: 429 })
    }
  }

  // Nonce per request
  const nonce = generateNonce()

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/anasayfa', request.url))
  }

  // Onboarding: profili olmayan veya okula bağlı olmayan kullanıcılar
  // Hızlı yol: school_id JWT metadata'da varsa DB sorgusu yok (joinSchool/setupSchool sırasında set edilir)
  // Fallback: mevcut kullanıcılar için metadata henüz yoksa profiles tablosuna bak
  if (user && !isPublicPath(pathname) && pathname !== '/onboarding') {
    const schoolIdFromMeta = user.user_metadata?.school_id as string | undefined
    if (!schoolIdFromMeta) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()
      if (!profile?.school_id) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  }

  // Set nonce + CSP + security headers on every response
  supabaseResponse.headers.set('x-nonce', nonce)
  supabaseResponse.headers.set('Content-Security-Policy', buildCsp(nonce))
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
