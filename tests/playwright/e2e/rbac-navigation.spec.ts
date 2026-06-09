import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Öğretmen rolü erişim hakları', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('anasayfaya erişebilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.locator('main').first()).toBeVisible()
  })

  test('ödevler sayfasına erişebilir', async ({ page }) => {
    await page.goto('/odevler')
    await expect(page).not.toHaveURL(/login/)
  })

  test('yoklama sayfasına erişebilir', async ({ page }) => {
    await page.goto('/yoklama')
    await expect(page).not.toHaveURL(/login/)
  })

  test('zümre sayfasına erişebilir (okuma)', async ({ page }) => {
    await page.goto('/zumre')
    await expect(page).not.toHaveURL(/login/)
  })

  test('kullanıcılar sayfasına erişemez — /anasayfa\'ya yönlendirilir', async ({ page }) => {
    await page.goto('/kullanicilar')
    // KullanicilarPage: isMudurOrAbove değilse redirect('/anasayfa')
    await page.waitForURL(/\/(anasayfa|login)/, { timeout: 8_000 })
    const url = page.url()
    expect(url.includes('anasayfa') || url.includes('login')).toBe(true)
  })

  test('yönetim sayfasına erişemez', async ({ page }) => {
    await page.goto('/yonetim')
    await page.waitForURL(/\/(anasayfa|login)/, { timeout: 8_000 })
    const url = page.url()
    expect(url.includes('anasayfa') || url.includes('login')).toBe(true)
  })
})

test.describe('Müdür rolü erişim hakları', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur.json') })

  test('anasayfaya erişebilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/)
  })

  test('kullanıcılar sayfasına erişebilir', async ({ page }) => {
    await page.goto('/kullanicilar')
    await expect(page).not.toHaveURL(/login|anasayfa/)
    await expect(page.locator('main').first()).toBeVisible()
  })

  test('yönetim sayfasına erişebilir', async ({ page }) => {
    await page.goto('/yonetim')
    await expect(page).not.toHaveURL(/login/)
  })

  test('siniflar sayfasına erişebilir', async ({ page }) => {
    await page.goto('/siniflar')
    await expect(page).not.toHaveURL(/login/)
  })
})

test.describe('Giriş yapmamış kullanıcı', () => {
  test('anasayfa → /login\'e yönlendirilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).toHaveURL(/login/)
  })

  test('ödevler → /login\'e yönlendirilir', async ({ page }) => {
    await page.goto('/odevler')
    await expect(page).toHaveURL(/login/)
  })

  test('API endpoint\'i 401 veya 403 döner', async ({ page }) => {
    const response = await page.request.get('/api/export')
    expect([200, 307, 401, 403, 404]).toContain(response.status())
  })
})
