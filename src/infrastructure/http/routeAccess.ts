// Route erişim kuralları — proxy.ts (middleware) tarafından kullanılır.
// Ayrı modül olmasının sebebi: test edilebilirlik. proxy.ts modül seviyesinde
// Supabase/Redis init ettiği için doğrudan import edilip test edilmesi zor;
// saf path mantığı burada izole.

// Auth redirect'inden muaf path'ler. Her biri ya gerçekten public (landing, login)
// ya da kendi imza/token doğrulamasını yapıyor (unsubscribe HMAC, veli token, inngest signing).
export const PUBLIC_PATHS = [
  '/', '/login', '/kayit', '/veli', '/yoklama-yazdir', '/onboarding', '/offline',
  '/gizlilik', '/kullanim-kosullari', '/sifremi-unuttum', '/auth/callback',
  // Public API — kendi imza/token doğrulamasına sahip, auth redirect'ten muaf
  '/api/inngest',      // Inngest signing key ile doğrular
  '/api/health',       // Health check — auth'suz erişilmeli (uptime monitörü)
  '/api/ready',        // Readiness probe
  '/api/live',         // Liveness probe
  '/api/unsubscribe',  // E-posta linki — HMAC imza doğrular
  '/api/veli/event',   // Veli portalı — public token doğrular (/api/ olduğu için /veli prefix'i kapsamaz)
]

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// IP rate-limit'ten muaf API path'leri:
// - health/ready/live: probe'lar sıfır-bağımlılık olmalı (Redis down ise fail-closed 429 atmamalı)
// - inngest: kendi signing'ine sahip + fan-out'ta 30/dk/IP limitini aşar
export const RATE_LIMIT_EXEMPT_API_PATHS = new Set([
  '/api/health',
  '/api/ready',
  '/api/live',
  '/api/inngest',
])
