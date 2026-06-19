import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Yoklama Çizelgesi', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('çizelge sayfası grid başlıklarını gösterir', async ({ page }) => {
    await page.goto('/yoklama/cizelge')
    await expect(page.getByRole('heading', { name: 'Yoklama Çizelgesi' })).toBeVisible({ timeout: 10_000 })
    // Sınıf varsa tablo, yoksa boş mesaj — ikisinden biri görünmeli
    await expect(
      page.locator('table').or(page.getByText('Görüntüleyebileceğiniz sınıf yok'))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('yoklama sayfasında 4 durumlu segmented control çalışır', async ({ page }) => {
    await page.goto('/yoklama')
    await expect(page).not.toHaveURL(/login/)
    // Öğrenci başına 4 ayrı durum butonu (Mevcut/Devamsız/Geç/Özürlü). Aktif olan `ring-2` ile işaretlenir.
    const firstRow = page.locator('ul li').first()
    const absent = firstRow.getByRole('button', { name: 'Devamsız' })
    await expect(absent).toBeVisible({ timeout: 10_000 })
    await absent.click()
    await expect(absent).toHaveClass(/ring-2/)
    const present = firstRow.getByRole('button', { name: 'Mevcut' })
    await present.click()
    await expect(present).toHaveClass(/ring-2/)
  })

  test('yoklama sayfasından çizelgeye geçiş linki çalışır', async ({ page }) => {
    await page.goto('/yoklama')
    await expect(page).not.toHaveURL(/login/)
    await page.getByRole('link', { name: /Çizelge/ }).click()
    await page.waitForURL(url => url.pathname === '/yoklama/cizelge', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Yoklama Çizelgesi' })).toBeVisible()
  })
})
