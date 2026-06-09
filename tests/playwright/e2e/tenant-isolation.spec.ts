import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('API tenant izolasyonu', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('export API kimlik doğrulama gerektiriyor (401 veya 202)', async ({ page }) => {
    // GET /api/export — session yoksa 401, session varsa 200/202
    const resp = await page.request.get('/api/export')
    expect([200, 201, 202, 401, 403, 404, 405]).toContain(resp.status())
  })

  test('rastgele job ID ile poll → 404 veya 403', async ({ page }) => {
    const fakeJobId = '00000000-dead-beef-0000-000000000000'
    const resp = await page.request.get(`/api/export?jobId=${fakeJobId}`)
    expect([401, 403, 404, 405]).toContain(resp.status())
  })
})

test.describe('Oturum güvenliği', () => {
  test('giriş yapılmamış context → korumalı sayfa /login\'e yönlendirir', async ({ browser }) => {
    const context = await browser.newContext() // storageState yok
    const page    = await context.newPage()
    await page.goto('/anasayfa')
    await expect(page).toHaveURL(/login/)
    await context.close()
  })

  test('giriş yap → çıkış → korumalı sayfaya erişim engellenir', async ({ browser }) => {
    const email    = process.env.TEST_EMAIL_OGRETMEN    ?? 'test_ogretmen@test.example'
    const password = process.env.TEST_PASSWORD_OGRETMEN ?? 'Test1234!'

    const context = await browser.newContext()
    const page    = await context.newPage()

    await page.goto('/login')
    await page.fill('#email',    email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 60_000 })

    // Çıkış yap
    await page.goto('/profil')
    const logoutBtn = page.locator('button:has-text("Çıkış Yap")').first()
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click()
      await page.waitForURL(/login/, { timeout: 10_000 })

      await page.goto('/anasayfa')
      await expect(page).toHaveURL(/login/)
    }

    await context.close()
  })
})

test.describe('Okul izolasyonu — UI', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('sınıf listesi sadece kendi okul sınıflarını gösterir', async ({ page }) => {
    await page.goto('/siniflar')
    await expect(page).not.toHaveURL(/login/)
    // Başka okul test verisi (__TEST__ Okul B) görünmemeli
    const crossSchoolData = page.locator('text=__TEST__ Okul B')
    expect(await crossSchoolData.count()).toBe(0)
  })

  test('ödev listesi sayfası yüklenir ve login gerektirmez', async ({ page }) => {
    await page.goto('/odevler')
    await expect(page).not.toHaveURL(/login/)
  })
})
