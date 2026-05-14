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
type RateLimiter = (key: string, limit: number, windowMs: number) => Promise<boolean>
let redisLimiter: RateLimiter | null = null

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
  } catch { return null }
}

const redisLimiterPromise = getRedisLimiter().then(l => { redisLimiter = l; return l })
void redisLimiterPromise

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function inMemoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) { rateLimitMap.set(key, { count: 1, resetAt: now + windowMs }); return true }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  return redisLimiter ? redisLimiter(key, limit, windowMs) : inMemoryLimit(key, limit, windowMs)
}

// ─── Middleware ───────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // Rate limits
  if (pathname === '/login' && request.method === 'POST') {
    if (!(await checkRateLimit(`login:${ip}`, 10, 60_000))) {
      return new NextResponse('Çok fazla istek. Lütfen bekleyin.', { status: 429 })
    }
  }
  if (isPublicPath(pathname) && pathname !== '/login') {
    if (!(await checkRateLimit(`public:${ip}`, 60, 60_000))) {
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

  // Onboarding: authenticated users without a school go to /onboarding
  if (user && !isPublicPath(pathname) && pathname !== '/onboarding') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()
    if (profile && !profile.school_id) {
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
