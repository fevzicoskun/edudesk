import { test, expect } from '@playwright/test'
import path from 'path'

// Aşama 2 sadeleştirmesi (2026-10-24)
const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')
test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

test('/profil → /ayarlar; profil bilgileri Ayarlar\'ın en üstünde, menüde Profil satırı yok', async ({ page }) => {
  await page.goto('/profil')
  await page.waitForURL(/\/ayarlar/)
  await expect(page.getByText('Ad Soyad')).toBeVisible()
  await expect(page.locator('aside').getByRole('link', { name: 'Profil', exact: true })).toHaveCount(0)
  // Çıkış yalnız menünün altında: sayfa gövdesinde düğme yok
  await expect(page.locator('main').getByRole('button', { name: 'Çıkış Yap' })).toHaveCount(0)
})

test('anasayfada sağ alttaki + düğmesi yok, ortadaki Yeni Ödev var; Ödevler sayfasında + duruyor', async ({ page }) => {
  await page.goto('/anasayfa')
  await expect(page.getByRole('link', { name: 'Yeni Ödev' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hızlı ödev ekle' })).toHaveCount(0)
  await page.goto('/odevler')
  await expect(page.getByRole('button', { name: 'Hızlı ödev ekle' })).toBeVisible()
  // Ödev takvimi bağlantısı yerinde, yalnız adı netleşti (sol menüdeki Takvim = okul takvimi, farklı sayfa)
  await expect(page.locator('main').getByRole('link', { name: 'Ödev takvimi', exact: true })).toHaveAttribute('href', '/odevler/takvim')
})

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('Daha Fazla çekmecesinin altında Çıkış Yap var', async ({ page }) => {
    await page.goto('/anasayfa')
    await page.getByRole('button', { name: 'Daha fazla' }).click()
    await expect(page.locator('button:has-text("Çıkış Yap"):visible')).toHaveCount(1)
  })
})
