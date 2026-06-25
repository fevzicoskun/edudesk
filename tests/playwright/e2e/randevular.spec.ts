import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Veli Görüşmeleri', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('sayfa açılır ve yeni randevu modalı çalışır', async ({ page }) => {
    await page.goto('/randevular')
    await expect(page.getByRole('heading', { name: 'Veli Görüşmeleri' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Yeni Randevu' }).click()
    await expect(page.getByRole('heading', { name: 'Yeni Randevu' })).toBeVisible({ timeout: 10_000 })
    // Tarih girişi görünür (boş-saat hesabının tetikleyicisi).
    // `getByLabel` ile scoped: sayfada birden fazla date input olabileceğinden (örn. Hızlı Ödev dialog).
    await expect(page.getByLabel('Tarih')).toBeVisible()
  })
})
