import { test, expect } from '@playwright/test'

// ─── Güvenlik Başlıkları ─────────────────────────────────────────────────────

test.describe('Güvenlik başlıkları', () => {
  test('CSP direktifleri doğru ayarlanmış', async ({ page }) => {
    const res = await page.goto('/login')
    const csp = res?.headers()['content-security-policy'] ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toMatch(/script-src 'self' 'nonce-/)
  })

  test('X-Frame-Options: DENY', async ({ page }) => {
    const res = await page.goto('/login')
    expect(res?.headers()['x-frame-options']).toBe('DENY')
  })

  test('X-Content-Type-Options: nosniff', async ({ page }) => {
    const res = await page.goto('/login')
    expect(res?.headers()['x-content-type-options']).toBe('nosniff')
  })

  test('Referrer-Policy: strict-origin-when-cross-origin', async ({ page }) => {
    const res = await page.goto('/login')
    expect(res?.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('Permissions-Policy kısıtlı', async ({ page }) => {
    const res = await page.goto('/login')
    const pp = res?.headers()['permissions-policy'] ?? ''
    expect(pp).toContain('camera=()')
    expect(pp).toContain('microphone=()')
    expect(pp).toContain('geolocation=()')
  })
})

// ─── Rate Limiting ───────────────────────────────────────────────────────────

// Her test run'ında benzersiz IP — 60 saniyelik pencere çakışmalarını önler
const runId = Math.floor(Math.random() * 65535)
function testIp(suffix: number) {
  return `10.${(runId >> 8) & 0xff}.${runId & 0xff}.${suffix}`
}

test.describe('Rate limiting', () => {
  test('/kayit POST — 3 izin, 4. istek 429 döner', async ({ request }) => {
    const headers = { 'X-Forwarded-For': testIp(1) }

    for (let i = 0; i < 3; i++) {
      const res = await request.post('/kayit', {
        headers,
        form: { schoolName: 'Test Okul', email: 'rl-test@example.com', contactName: 'Test' },
      })
      expect(res.status()).not.toBe(429)
    }

    const blocked = await request.post('/kayit', {
      headers,
      form: { schoolName: 'Test Okul', email: 'rl-test@example.com', contactName: 'Test' },
    })
    expect(blocked.status()).toBe(429)
  })

  test('/sifremi-unuttum POST — 3 izin, 4. istek 429 döner', async ({ request }) => {
    const headers = { 'X-Forwarded-For': testIp(2) }

    for (let i = 0; i < 3; i++) {
      const res = await request.post('/sifremi-unuttum', {
        headers,
        form: { email: 'rl-test@example.com' },
      })
      expect(res.status()).not.toBe(429)
    }

    const blocked = await request.post('/sifremi-unuttum', {
      headers,
      form: { email: 'rl-test@example.com' },
    })
    expect(blocked.status()).toBe(429)
  })

  test('/api/export — kimliksiz istek Excel döndürmez', async ({ request }) => {
    // Middleware kimliksiz isteği /login'e redirect eder → content-type HTML, Excel değil
    const res = await request.post('/api/export', {
      headers: { 'X-Forwarded-For': testIp(3) },
      data: { jobType: 'excel_odevler' },
      failOnStatusCode: false,
    })
    const ct = res.headers()['content-type'] ?? ''
    expect(ct).not.toContain('spreadsheetml')
    // redirect sonrası URL /login veya direkt 401/403
    const isLoginRedirect = res.url().includes('/login')
    const isAuthError = [401, 403].includes(res.status())
    expect(isLoginRedirect || isAuthError).toBe(true)
  })
})
