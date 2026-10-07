import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)

/** Hiç mentör öğrencisi olmayan öğretmen ilk öğrencisini öğrenci sayfasından ekler (menü gizliyken giriş yolu). */
test.describe('Mentörlüğüme ekle', () => {
  test.use({ storageState: AUTH('ogretmen') })

  test('öğrenci sayfasından eklenir, menüde Mentörlük belirir, listeden çıkarılınca temizlenir', async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto('/siniflar')
    await page.locator('a[href^="/siniflar/"]').first().click()
    await page.waitForURL(/\/siniflar\/[0-9a-f-]{36}$/)
    await page.locator('a[href*="/ogrenciler/"]').first().click()
    await page.waitForURL(/\/ogrenciler\/[0-9a-f-]{36}$/)
    const ad = (await page.getByRole('heading', { level: 1 }).textContent())!.trim()

    // Başlangıç: mentörü yok, menüde Mentörlük yok
    await expect(page.getByText(/^Mentörü:/)).toHaveCount(0)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Mentörlük' })).toHaveCount(0)

    const ekle = page.getByRole('button', { name: 'Mentörlüğüme ekle' })
    await expect(async () => {
      await ekle.click()
      await expect(page.getByText('Mentörü: PW Test ogretmen')).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await expect(ekle).toHaveCount(0)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Mentörlük' })).toBeVisible()

    // Temizlik: mentörlük sayfasından listeden çıkar
    await page.goto('/mentorluk')
    await page.locator('table').getByRole('link', { name: ad }).click()
    await page.getByRole('button', { name: 'Listeden çıkar' }).click()
    await page.getByRole('button', { name: 'Çıkar' }).click()
    await expect(page).toHaveURL(/\/mentorluk$/, { timeout: 15_000 })
    await expect(page.locator('table').getByRole('link', { name: ad })).toHaveCount(0)
  })
})
