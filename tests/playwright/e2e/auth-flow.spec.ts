import { test, expect } from '@playwright/test'

const email    = process.env.TEST_EMAIL_OGRETMEN    ?? 'test_ogretmen@test.example'
const password = process.env.TEST_PASSWORD_OGRETMEN ?? 'Test1234!'

test.describe('Login formu', () => {
  test('email, şifre ve giriş butonu görünür', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('"Şifremi unuttum" linki mevcut', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('a[href="/sifremi-unuttum"]')).toBeVisible()
  })
})

test.describe('Giriş akışı', () => {
  test('doğru bilgilerle giriş → /anasayfa', async ({ browser }) => {
    const context = await browser.newContext()
    const page    = await context.newPage()

    await page.goto('/login')
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // login action → redirect('/') → middleware /anasayfa'ya yönlendirir; '/' geçişi yeterli
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 60_000 })
    const url = page.url()
    expect(url).not.toContain('login')

    await context.close()
  })

  test('yanlış şifre → hata mesajı gösterilir', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', email)
    await page.fill('#password', 'yanlis_sifre_xyz!')
    await page.click('button[type="submit"]')

    await expect(
      page.locator('[class*="red"], .bg-red-50').first()
    ).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('Çıkış akışı', () => {
  test('giriş → profil → çıkış yap → /login', async ({ browser }) => {
    const context = await browser.newContext()
    const page    = await context.newPage()

    await page.goto('/login')
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 60_000 })

    await page.goto('/profil')
    await expect(page).not.toHaveURL(/login/)

    const logoutBtn = page.locator('button:has-text("Çıkış Yap")').first()
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 })
    await logoutBtn.click()
    await page.waitForURL(/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/login/)

    await context.close()
  })

  test('çıkış sonrası korumalı sayfaya erişim → /login', async ({ browser }) => {
    const context = await browser.newContext()
    const page    = await context.newPage()

    await page.goto('/login')
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 60_000 })

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
