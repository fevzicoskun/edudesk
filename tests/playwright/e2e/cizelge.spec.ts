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

  test('yoklama sayfasında 4 durumlu toggle çalışır', async ({ page }) => {
    await page.goto('/yoklama')
    await expect(page).not.toHaveURL(/login/)
    const firstToggle = page.locator('ul button').first()
    await expect(firstToggle).toBeVisible({ timeout: 10_000 })
    // Mevcut → Devamsız → Geç → Özürlü → Mevcut
    await firstToggle.click()
    await firstToggle.click()
    await firstToggle.click()
    await expect(firstToggle).toHaveText('Özürlü')
    await firstToggle.click()
    await expect(firstToggle).toHaveText('Mevcut')
  })

  test('yoklama sayfasından çizelgeye geçiş linki çalışır', async ({ page }) => {
    await page.goto('/yoklama')
    await expect(page).not.toHaveURL(/login/)
    await page.getByRole('link', { name: /Çizelge/ }).click()
    await page.waitForURL(url => url.pathname === '/yoklama/cizelge', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Yoklama Çizelgesi' })).toBeVisible()
  })
})
