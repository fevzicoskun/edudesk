import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// /veli/[token], /yoklama-yazdir/[token] → token-based public routes
const PUBLIC_PATHS = ['/login', '/veli', '/yoklama-yazdir']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// ─── Rate limiting ────────────────────────────────────────────
// Uses Upstash Redis when env vars are present; falls back to in-memory for dev.

type RateLimiter = (key: string, limit: number, windowMs: number) => Promise<boolean>

let redisLimiter: RateLimiter | null = null

async function getRedisLimiter(): Promise<RateLimiter | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  try {
    const { Redis } = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    const loginLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:login' })
    const publicLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), prefix: 'rl:public' })

    return async (key: string, limit: number, _windowMs: number) => {
      const limiter = limit <= 10 ? loginLimit : publicLimit
      const { success } = await limiter.limit(key)
      return success
    }
  } catch {
    return null
  }
}

// Eagerly resolve the Redis limiter (module-level singleton)
const redisLimiterPromise: Promise<RateLimiter | null> = getRedisLimiter().then(l => {
  redisLimiter = l
  return l
})
void redisLimiterPromise

// Fallback: in-memory (resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function inMemoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (redisLimiter) {
    return redisLimiter(key, limit, windowMs)
  }
  return inMemoryLimit(key, limit, windowMs)
}

// ─── Middleware ───────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // Rate limit login attempts: 10 per minute per IP
  if (pathname === '/login' && request.method === 'POST') {
    if (!(await checkRateLimit(`login:${ip}`, 10, 60_000))) {
      return new NextResponse('Çok fazla istek. Lütfen bekleyin.', { status: 429 })
    }
  }

  // Rate limit public token routes: 60 per minute per IP
  if (isPublicPath(pathname) && pathname !== '/login') {
    if (!(await checkRateLimit(`public:${ip}`, 60, 60_000))) {
      return new NextResponse('Çok fazla istek.', { status: 429 })
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
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

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
