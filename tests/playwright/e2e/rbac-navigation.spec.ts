/**
 * RBAC navigasyon testleri — UI seviyesinde rol bazlı erişim.
 * Öğretmen vs müdür için hangi sayfaların görünür/erişilebilir olduğunu doğrular.
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

// ── Öğretmen erişim testleri ──────────────────────────────────
test.describe('Öğretmen rolü erişim hakları', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('anasayfaya erişebilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.locator('h1, main')).toBeVisible()
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

  test('kullanıcılar sayfasına erişemez — yönlendirme alır', async ({ page }) => {
    await page.goto('/kullanicilar')
    // ya login'e ya da 403/anasayfaya yönlenmeli
    const url = page.url()
    const isBlocked = url.includes('login') || url.includes('anasayfa') ||
                      url.includes('yetki') || !url.includes('kullanicilar')
    expect(isBlocked).toBe(true)
  })

  test('yönetim sayfasına erişemez', async ({ page }) => {
    await page.goto('/yonetim')
    const url = page.url()
    const isBlocked = url.includes('login') || url.includes('anasayfa') ||
                      !url.includes('yonetim')
    expect(isBlocked).toBe(true)
  })
})

// ── Müdür erişim testleri ─────────────────────────────────────
test.describe('Müdür rolü erişim hakları', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur.json') })

  test('anasayfaya erişebilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).not.toHaveURL(/login/)
  })

  test('kullanıcılar sayfasına erişebilir', async ({ page }) => {
    await page.goto('/kullanicilar')
    await expect(page).not.toHaveURL(/login|anasayfa/)
    await expect(page.locator('main')).toBeVisible()
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

// ── Giriş yapmamış kullanıcı testleri ────────────────────────
test.describe('Giriş yapmamış kullanıcı', () => {
  test('anasayfa → /login\'e yönlendirilir', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page).toHaveURL(/login/)
  })

  test('ödevler → /login\'e yönlendirilir', async ({ page }) => {
    await page.goto('/odevler')
    await expect(page).toHaveURL(/login/)
  })

  test('API endpoint\'i 401 döner', async ({ page }) => {
    const response = await page.request.get('/api/export')
    expect(response.status()).toBe(401)
  })
})
