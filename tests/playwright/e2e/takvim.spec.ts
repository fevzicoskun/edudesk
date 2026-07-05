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

  test('etkinlik ekler, takvimde görünür, sonra siler', async ({ page }) => {
    await page.goto('/takvim?ay=2026-09')
    await expect(page.getByRole('heading', { name: 'Takvim' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: '+ Etkinlik' }).click()
    await expect(page.getByRole('heading', { name: 'Yeni Etkinlik' })).toBeVisible()
    const title = `E2E Gezi ${Date.now()}`
    await page.getByLabel('Başlık').fill(title)
    await page.getByLabel('Tarih').fill('2026-09-15')
    await page.getByRole('button', { name: 'Kaydet' }).click()

    // Modal kapanır, 15 Eylül hücresine tıkla → panelde etkinlik görünür
    await expect(page.getByRole('heading', { name: 'Yeni Etkinlik' })).toHaveCount(0, { timeout: 10_000 })
    await page.getByRole('button', { name: /15 Eylül 2026/ }).click()
    // Başlık DOM'da iki kez var (masaüstü paneli + gizli mobil ajanda) → görünür olanı doğrula
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 })

    // Temizlik: sil (seed kirliliği bırakma) — Sil butonu bu etkinliğin satırına kapsamlı
    await page.locator('li').filter({ hasText: title }).getByRole('button', { name: 'Sil' }).first().click()
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 })
  })
})
