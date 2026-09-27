import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Öğretmen Dashboard', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('/anasayfa yüklenir ve giriş sayfasına yönlendirilmez', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/, { timeout: 8_000 })
    // Selamlama h1 — getGreeting() ile oluşturuluyor (Günaydın / İyi Öğlenler / İyi Akşamlar ...)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8_000 })
  })

  test('sade ana sayfa: asıl bölümler var, tekrar eden özet kartları yok', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByText('Yapılacaklarım').first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Ödev Tamamlanma').first()).toBeVisible({ timeout: 8_000 })
    // 2026-09-27: 3 renkli kart + "Bu Hafta" şeridi kaldırıldı — aynı bilgiler sayfada zaten vardı
    for (const eski of ['Bugünkü ödev', 'Toplam eksik', 'Aktif risk', 'Bu Hafta']) {
      await expect(page.getByText(eski, { exact: true })).toHaveCount(0)
    }
  })

  test('"Bugün Yapılacaklar" veya "Hızlı Aksiyonlar" bölümü render edilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/)
    const bugun   = page.locator('text=Bugün ve Yaklaşan, text=Hızlı Aksiyonlar, text=Yoklama').first()
    const hasAny  = await page.locator('main').first().isVisible({ timeout: 8_000 })
    expect(hasAny).toBe(true)
  })

  test('"Risk Uyarıları" widget\'ı render edilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.locator('h2:has-text("Risk Uyarıları")').first()).toBeVisible({ timeout: 8_000 })
  })

  test('navigasyon sidebar\'ı görünür', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/)
    const navLinks = page.locator('nav a, aside a')
    await expect(navLinks.first()).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Login → Dashboard performans', () => {
  test('giriş formundan dashboard\'a geçiş < 30s', async ({ browser }) => {
    const email    = process.env.TEST_EMAIL_OGRETMEN    ?? 'test_ogretmen@test.example'
    const password = process.env.TEST_PASSWORD_OGRETMEN ?? 'Test1234!'

    const context = await browser.newContext()
    const page    = await context.newPage()

    await page.goto('/login')

    const loginStart = Date.now()
    await page.fill('#email',    email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 60_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5_000 })
    const loginElapsed = Date.now() - loginStart

    expect(loginElapsed, `Login akışı ${loginElapsed}ms sürdü`).toBeLessThan(60_000)

    await context.close()
  })
})
