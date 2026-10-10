import { test, expect, type Page } from '@playwright/test'
import path from 'path'

// Spec: docs/superpowers/specs/2026-10-10-yoklama-anahtari-design.md — test okulu her durumda AÇIK bırakılır.
const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

async function anahtariAyarla(page: Page, acik: boolean) {
  await page.goto('/ayarlar')
  const anahtar = page.getByRole('switch', { name: 'Yoklama modülü' })
  await expect(anahtar).toBeVisible({ timeout: 20_000 })
  if ((await anahtar.getAttribute('aria-checked')) !== String(acik)) {
    await anahtar.click()
    await expect(anahtar).toHaveAttribute('aria-checked', String(acik), { timeout: 10_000 })
    // iyimser güncelleme: sunucu kaydı bitene kadar düğme kilitli — bitmeden sayfadan çıkılırsa kayıt kesilir
    await expect(anahtar).toBeEnabled({ timeout: 15_000 })
    await expect(page.locator('section', { hasText: 'Okul ayarları' }).getByRole('alert')).toHaveCount(0)
    await expect(anahtar).toHaveAttribute('aria-checked', String(acik))
  }
}

test.describe('Yoklama anahtarı — müdür yardımcısı', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur_yardimcisi.json') })

  test('kapatınca yoklama parçaları kaybolur, açınca geri gelir', async ({ page }) => {
    try {
      await anahtariAyarla(page, false)
      await page.goto('/anasayfa')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText('Yoklama Alınan Sınıf')).toHaveCount(0)
      await expect(page.getByText(/sınıf yoklaması girilmemiş/)).toHaveCount(0)

      await anahtariAyarla(page, true)
      await page.goto('/anasayfa')
      await expect(page.getByText('Yoklama Alınan Sınıf')).toBeVisible({ timeout: 20_000 })
    } finally {
      await anahtariAyarla(page, true)
    }
  })
})

test.describe('Yoklama anahtarı — öğretmen', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })
  test('öğretmen Ayarlar\'da okul ayarlarını görmez', async ({ page }) => {
    await page.goto('/ayarlar')
    await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('switch', { name: 'Yoklama modülü' })).toHaveCount(0)
  })
})
