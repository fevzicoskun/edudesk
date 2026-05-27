/**
 * Öğretmen dashboard E2E testleri — Sprint 1 kabul kriteri.
 * Kapsam: login → dashboard yüklenme < 2s, temel bileşenler görünür.
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

const PERF_BUDGET_MS = 2000

test.describe('Öğretmen Dashboard', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('anasayfa < 2s yüklenir ve temel içerik görünür', async ({ page }) => {
    const t0 = Date.now()
    await page.goto('/anasayfa')

    // Başlık ve 3 özet kartı görünür olana kadar bekle
    await expect(page.locator('h1:has-text("Anasayfa")')).toBeVisible({ timeout: PERF_BUDGET_MS })
    const elapsed = Date.now() - t0

    expect(elapsed, `Dashboard ${elapsed}ms'de yüklendi — bütçe ${PERF_BUDGET_MS}ms`).toBeLessThan(PERF_BUDGET_MS)

    // Login sayfasına yönlendirilmemeli
    await expect(page).not.toHaveURL(/login/)
  })

  test('3 özet kart görünür — Bugünkü ödev, Toplam eksik, Aktif risk', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page.locator('h1:has-text("Anasayfa")')).toBeVisible()

    await expect(page.locator('text=Bugünkü ödev')).toBeVisible()
    await expect(page.locator('text=Toplam eksik')).toBeVisible()
    await expect(page.locator('text=Aktif risk')).toBeVisible()
  })

  test('haftalık özet şeridi görünür', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page.locator('text=Bu Hafta')).toBeVisible()
    await expect(page.locator('text=Teslim edilen')).toBeVisible()
    await expect(page.locator('text=Ort. tamamlanma')).toBeVisible()
    await expect(page.locator('text=Yeni risk')).toBeVisible()
  })

  test('"Bugün ve Yaklaşan" bölümü render edilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page.locator('text=Bugün ve Yaklaşan')).toBeVisible()
    // Boş durum veya içerik — her ikisi de kabul edilir
    const emptyState    = page.locator('text=Bugün veya önümüzdeki 7 gün için ödev yok')
    const odevlerLink   = page.locator('a[href="/odevler"]')
    const hasEmpty   = await emptyState.count() > 0
    const hasLink    = await odevlerLink.count() > 0
    expect(hasEmpty || hasLink).toBe(true)
  })

  test('"Risk Uyarıları" widget\'ı render edilir', async ({ page }) => {
    await page.goto('/anasayfa')
    // Widget başlığı her durumda görünmeli (h2 kesin var; empty msg opsiyonel)
    await expect(page.locator('h2:has-text("Risk Uyarıları")').first()).toBeVisible({ timeout: 5000 })
  })

  test('navigasyon sidebar\'ı görünür', async ({ page }) => {
    await page.goto('/anasayfa')
    // Sidebar linkleri — en az birinin mevcut olması yeterli
    const navLinks = page.locator('nav a, aside a')
    await expect(navLinks.first()).toBeVisible()
  })
})

// ── Login akışı performans testi ──────────────────────────────
test.describe('Login → Dashboard performans', () => {
  test('giriş formundan dashboard\'a geçiş < 5s', async ({ browser }) => {
    const email    = process.env.TEST_EMAIL_OGRETMEN    ?? 'test_ogretmen@test.example'
    const password = process.env.TEST_PASSWORD_OGRETMEN ?? 'Test1234!'

    const context = await browser.newContext()
    const page    = await context.newPage()

    await page.goto('/login')

    const loginStart = Date.now()
    await page.fill('input[name="email"]',    email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')

    await page.waitForURL(/\/(anasayfa|dashboard)/, { timeout: 5000 })
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 })
    const loginElapsed = Date.now() - loginStart

    expect(loginElapsed, `Login akışı ${loginElapsed}ms sürdü`).toBeLessThan(5000)

    await context.close()
  })
})
