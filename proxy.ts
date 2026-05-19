import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Public paths ─────────────────────────────────────────────
const PUBLIC_PATHS = ['/login', '/veli', '/yoklama-yazdir', '/onboarding']

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
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
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
    const loginLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:login' })
    const publicLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), prefix: 'rl:public' })
    return async (key, limit) => {
      const { success } = await (limit <= 10 ? loginLimit : publicLimit).limit(key)
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
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/anasayfa', request.url))
  }

  // Onboarding: profili olmayan veya okula bağlı olmayan kullanıcılar
  if (user && !isPublicPath(pathname) && pathname !== '/onboarding') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()
    if (!profile || !profile.school_id) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // Set nonce + CSP + security headers on every response
  supabaseResponse.headers.set('x-nonce', nonce)
  supabaseResponse.headers.set('Content-Security-Policy', buildCsp(nonce))
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
