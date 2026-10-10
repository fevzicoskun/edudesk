import { test, expect, type Page } from '@playwright/test'
import path from 'path'

// Spec: docs/superpowers/specs/2026-10-10-yoklama-anahtari-design.md — test okulu her durumda AÇIK bırakılır.
const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

/** "Diğer" grubundaki bir sayfada (Profil) grup kendiliğinden açıktır — tıklamak localStorage geri yüklemesiyle yarışır */
async function menuLinki(page: Page, ad: string) {
  await page.goto('/profil')
  const menu = page.locator('aside').first()
  await expect(menu.getByRole('link', { name: 'Profil' })).toBeVisible({ timeout: 15_000 })
  return menu.getByRole('link', { name: ad })
}

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
      await expect(await menuLinki(page, 'Devamsızlık Raporu')).toHaveCount(0)
      // MY ana sayfa: Devamsızlık Riski kartı ve Öğretmen Aktivitesi'nde Yoklama sütunu yok
      await page.goto('/anasayfa')
      await expect(page.locator('main').getByText('Öğretmen Aktivitesi', { exact: true })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('heading', { name: 'Devamsızlık Riski' })).toHaveCount(0)
      await expect(page.getByText('Yoklama', { exact: true })).toHaveCount(0)
      // Okul Durumu: bugün yoklama ve aylık devamsızlık kartları yok
      await page.goto('/yonetim')
      await expect(page.getByRole('heading', { name: 'Okul Durumu' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText('Bu Ay Devamsızlık')).toHaveCount(0)
      await expect(page.getByText(/Yoklama: \d+ \/ \d+ sınıf/)).toHaveCount(0)
      // Aktivite raporu: Yoklama sütunu yok
      await page.goto('/rapor/ogretmen-aktivite')
      await expect(page.getByRole('columnheader', { name: 'Ödev' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('columnheader', { name: 'Yoklama' })).toHaveCount(0)

      await anahtariAyarla(page, true)
      await page.goto('/anasayfa')
      await expect(page.getByText('Yoklama Alınan Sınıf')).toBeVisible({ timeout: 20_000 })
      await expect(await menuLinki(page, 'Devamsızlık Raporu')).toHaveCount(1)
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

test.describe('Yoklama anahtarı — müdür', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur.json') })
  test('kapalıyken müdür ana sayfasında devamsızlık trendi ve sınıf karşılaştırması yok', async ({ page }) => {
    try {
      await anahtariAyarla(page, false)
      await page.goto('/anasayfa')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText('Sınıf karşılaştırması — devamsızlık')).toHaveCount(0)
      await expect(page.getByText(/Devamsızlık oranı|devamsızlık oranı/)).toHaveCount(0)
      await expect(page.getByText(/Yoklama kapsama|yoklama kapsama/)).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Devamsızlık Riski' })).toHaveCount(0)
    } finally {
      await anahtariAyarla(page, true)
    }
  })
})
