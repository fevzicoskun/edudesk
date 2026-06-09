import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Ödev listesi', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('/odevler sayfası yüklenir', async ({ page }) => {
    await page.goto('/odevler')
    await expect(page).not.toHaveURL(/login/)
    // Sayfa içeriği — yükleniyor spinner veya liste bekliyoruz
    await expect(page.locator('main')).toBeVisible({ timeout: 8_000 })
  })

  test('filtre çubuğu veya başlık alanı görünür', async ({ page }) => {
    await page.goto('/odevler')
    await expect(page).not.toHaveURL(/login/)
    // Arama inputu veya filtre bar
    const filterOrSearch = page.locator(
      'input[type="search"], input[placeholder*="ara"], input[placeholder*="Ara"], [data-filter-bar]'
    )
    const hasFilter = await filterOrSearch.count() > 0
    // Filtre yoksa en azından bir link olmalı (/odevler/yeni)
    const newLink = page.locator('a[href*="/odevler/yeni"], a[href*="yeni"]')
    const hasNew  = await newLink.count() > 0
    expect(hasFilter || hasNew).toBe(true)
  })

  test('"Yeni ödev" linkine tıklanabilir', async ({ page }) => {
    await page.goto('/odevler')
    await expect(page).not.toHaveURL(/login/)

    const newLink = page.locator('a[href*="/odevler/yeni"]').first()
    if (await newLink.count() > 0) {
      await newLink.click()
      await expect(page).toHaveURL(/\/odevler\/yeni/)
    }
  })
})

test.describe('Yeni ödev formu', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('/odevler/yeni sayfası yüklenir', async ({ page }) => {
    await page.goto('/odevler/yeni')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.locator('form').first()).toBeVisible({ timeout: 8_000 })
  })

  test('başlık alanı görünür ve yazılabilir', async ({ page }) => {
    await page.goto('/odevler/yeni')
    await expect(page).not.toHaveURL(/login/)

    const titleInput = page.locator(
      'input[name="title"], input[placeholder*="başlık"], input[placeholder*="Başlık"]'
    ).first()
    await expect(titleInput).toBeVisible({ timeout: 5_000 })
    await titleInput.fill('Test ödev başlığı')
    await expect(titleInput).toHaveValue('Test ödev başlığı')
  })

  test('ders / konu alanı görünür', async ({ page }) => {
    await page.goto('/odevler/yeni')
    await expect(page).not.toHaveURL(/login/)

    const subjectField = page.locator(
      'input[name="subject"], select[name="subject"], input[placeholder*="ders"], input[placeholder*="konu"]'
    ).first()
    await expect(subjectField).toBeVisible({ timeout: 5_000 })
  })

  test('teslim tarihi alanı görünür', async ({ page }) => {
    await page.goto('/odevler/yeni')
    await expect(page).not.toHaveURL(/login/)

    const dateInput = page.locator('input[name="due_date"], input[type="date"]').first()
    await expect(dateInput).toBeVisible({ timeout: 5_000 })
  })

  test('sınıf seçilmeden submit butonu disabled', async ({ page }) => {
    await page.goto('/odevler/yeni')
    await expect(page).not.toHaveURL(/login/)

    // Sınıf seçilmemiş → buton "Sınıf Seçin" veya disabled olmalı
    const submitBtn = page.locator('button[type="submit"]').last()
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })

    const isDisabled = await submitBtn.isDisabled()
    const btnText    = await submitBtn.textContent()
    expect(isDisabled || btnText?.includes('Sınıf Seçin')).toBe(true)
  })

  test('sınıf seçilince submit butonu aktif olur', async ({ page }) => {
    await page.goto('/odevler/yeni')
    await expect(page).not.toHaveURL(/login/)

    // Sınıf chip'lerini bul
    const classChips = page.locator('[data-class-id], button:has-text("-"), .class-chip')
    if (await classChips.count() === 0) {
      test.skip() // Test kullanıcısının okulunda sınıf yok
      return
    }

    await classChips.first().click()
    const submitBtn = page.locator('button[type="submit"]').last()
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
  })
})
