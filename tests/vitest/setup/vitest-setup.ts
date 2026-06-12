/**
 * Her test dosyasından önce çalışır.
 * Next.js / React özelliklerini Node.js ortamı için mock'lar.
 */
import { vi } from 'vitest'
import dotenv from 'dotenv'

// .env.local dosyasını yükle (CI'da gerçek env değişkenleri kullanılır)
dotenv.config({ path: '.env.local' })

// ── React cache → testlerde passthrough ──────────────────────
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  }
})

// ── next/navigation ──────────────────────────────────────────
vi.mock('next/navigation', () => ({
  redirect:    vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  useRouter:   vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

// ── next/headers ─────────────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get:    vi.fn(),
    set:    vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
    has:    vi.fn(() => false),
  })),
  headers: vi.fn(() => ({
    get: vi.fn(),
    has: vi.fn(() => false),
  })),
}))

// ── next/cache ───────────────────────────────────────────────
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}))

// ── server-only → Node.js testlerinde no-op ──────────────────
vi.mock('server-only', () => ({}))

// ── pino logger → unit testlerde no-op ──────────────────────
vi.mock('@/src/infrastructure/observability/logger', () => {
  const noop = vi.fn()
  const child = vi.fn().mockReturnValue({ info: noop, warn: noop, error: noop, debug: noop, fatal: noop })
  return {
    logger:      { info: noop, warn: noop, error: noop, debug: noop, fatal: noop, child },
    childLogger: child,
    securityLog: noop,
  }
})
