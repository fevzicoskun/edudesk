import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Güvenlik ağı: test yarıda kesilse bile (süre aşımı vb.) test okulunun yoklaması AÇIK bırakılır
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.afterAll(async () => {
  await db.from('schools').update({ yoklama_aktif: true }).like('name', '__PW_TEST__%')
})

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
      // MY ana sayfa (Okul Durumu buraya katıldı): Devamsızlık Riski, bugün yoklama, aylık devamsızlık yok
      await page.goto('/anasayfa')
      await expect(page.getByRole('heading', { name: 'Öğretmen takibi' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('heading', { name: 'Devamsızlık Riski' })).toHaveCount(0)
      await expect(page.getByText('Yoklama', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Bu Ay Devamsızlık' })).toHaveCount(0)
      await expect(page.getByText(/Yoklama: \d+ \/ \d+ sınıf/)).toHaveCount(0)
      // Aktivite raporu: Yoklama sütunu yok
      await page.goto('/rapor/ogretmen-aktivite')
      await expect(page.getByRole('columnheader', { name: 'Ödev' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('columnheader', { name: 'Yoklama' })).toHaveCount(0)

      await anahtariAyarla(page, true)
      await page.goto('/anasayfa')
      await expect(page.getByText('Yoklama Alınan Sınıf')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('heading', { name: 'Bu Ay Devamsızlık' })).toBeVisible()
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

test.describe('Yoklama anahtarı — kapalıyken sayfalar', () => {
  test('öğretmen: /yoklama "modül kapalı" der, öğrenci sayfasında devamsızlık yok; idare: devamsızlık raporu kapalı', async ({ browser }) => {
    const my  = await browser.newContext({ storageState: path.join(AUTH_DIR, 'mudur_yardimcisi.json') })
    const ogr = await browser.newContext({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })
    const myPage = await my.newPage(), ogrPage = await ogr.newPage()
    try {
      await anahtariAyarla(myPage, false)

      await ogrPage.goto('/yoklama')
      await expect(ogrPage.getByText('Yoklama modülü kapalı')).toBeVisible({ timeout: 20_000 })

      // öğretmenin sınıfındaki ilk öğrencinin sayfası — ayrı sekmede (önceki sayfanın yüklemesiyle çakışmasın)
      const ogrSayfa = await ogr.newPage()
      await ogrSayfa.goto('/siniflar')
      await ogrSayfa.locator('a[href^="/siniflar/"]').first().click()
      await ogrSayfa.locator('a[href*="/ogrenciler/"]').first().click()
      await expect(ogrSayfa).toHaveURL(/\/ogrenciler\/[0-9a-f-]+$/, { timeout: 20_000 })
      await expect(ogrSayfa.getByText('Ödev Geçmişi')).toBeVisible({ timeout: 20_000 })
      await expect(ogrSayfa.getByText('Devamsızlık', { exact: true })).toHaveCount(0)

      await myPage.goto('/rapor/devamsizlik')
      await expect(myPage.getByText('Yoklama modülü kapalı')).toBeVisible({ timeout: 20_000 })
      await expect(myPage.getByRole('link', { name: 'Ayarlar' }).last()).toBeVisible()
    } finally {
      await anahtariAyarla(myPage, true)
      await my.close(); await ogr.close()
    }
  })
})
