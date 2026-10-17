import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Takvim — öğretmen', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('sayfa açılır, ızgara render olur, etkinlik butonu GÖRÜNMEZ', async ({ page }) => {
    await page.goto('/takvim')
    await expect(page.getByRole('heading', { name: 'Takvim' })).toBeVisible({ timeout: 10_000 })
    // Gün başlıkları (masaüstü ızgara)
    await expect(page.getByText('Pzt', { exact: true })).toBeVisible()
    // Öğretmen etkinlik ekleyemez
    await expect(page.getByRole('button', { name: '+ Etkinlik' })).toHaveCount(0)
  })

  test('ay gezinme çalışır', async ({ page }) => {
    await page.goto('/takvim?ay=2026-07')
    await expect(page.getByText('Temmuz 2026', { exact: true })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: 'Sonraki ay' }).click()
    await expect(page.getByText('Ağustos 2026', { exact: true })).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Takvim — müdür', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur.json') })

  // Etkinlik ekleme kaldırıldı (2026-10-17, hiç kullanılmadı) — müdür de takvimi yalnız görür
  test('takvim açılır, etkinlik düğmesi yok', async ({ page }) => {
    await page.goto('/takvim?ay=2026-09')
    await expect(page.getByRole('heading', { name: 'Takvim' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Eylül 2026', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Etkinlik' })).toHaveCount(0)
  })
})
