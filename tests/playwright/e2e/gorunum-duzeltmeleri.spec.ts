import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Görünüm düzeltmeleri — öğretmen', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json'), viewport: { width: 1280, height: 860 } })

  test('sol menünün arka planı ekranın altına kadar uzanır (yarıda bitmez)', async ({ page }) => {
    await page.goto('/siniflar')
    const menu = page.locator('aside').first()
    await expect(menu).toBeVisible({ timeout: 20_000 })
    const kutu = await menu.boundingBox()
    expect(kutu!.y + kutu!.height).toBeGreaterThanOrEqual(860 - 1)
  })
  test('sağ alttaki "+" düğmesi sayfanın son içeriğini kapatmaz (altta düğme kadar boşluk)', async ({ page }) => {
    await page.goto('/ders-programi')
    const arti = page.locator('button.fixed.rounded-full').first()
    await expect(arti).toBeVisible({ timeout: 20_000 })
    const main = page.locator('main')
    await main.evaluate(m => m.scrollTo(0, m.scrollHeight))
    const sonIcerik = await main.evaluate(m => {
      const els = [...m.querySelectorAll('section, div')].filter(e => e.getBoundingClientRect().height > 0)
      return Math.max(...els.map(e => e.getBoundingClientRect().bottom))
    })
    const artiUst = (await arti.boundingBox())!.y
    expect(sonIcerik).toBeLessThanOrEqual(artiUst)
  })
})

// Liste/genel bakış sayfaları aynı genişlikte: başlık soldan aynı hizada başlar
async function baslikX(page: import('@playwright/test').Page, yol: string) {
  await page.goto(yol)
  const h1 = page.getByRole('heading', { level: 1 }).first()
  await expect(h1).toBeVisible({ timeout: 20_000 })
  return Math.round((await h1.boundingBox())!.x)
}

test.describe('Sayfa genişlikleri — öğretmen', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json'), viewport: { width: 1600, height: 900 } })
  test('genel bakış sayfalarında başlık aynı hizada', async ({ page }) => {
    const ref = await baslikX(page, '/odevler')
    for (const y of ['/siniflar', '/mentorluk', '/takvim', '/ders-programi', '/randevular']) {
      expect(await baslikX(page, y), y).toBe(ref)
    }
  })
})

test.describe('Sayfa genişlikleri — müdür yardımcısı', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur_yardimcisi.json'), viewport: { width: 1600, height: 900 } })
  test('yönetim sayfalarında başlık aynı hizada', async ({ page }) => {
    const ref = await baslikX(page, '/kullanicilar')
    for (const y of ['/yonetim', '/nobet', '/rapor/devamsizlik', '/rapor/ogretmen-aktivite']) {
      expect(await baslikX(page, y), y).toBe(ref)
    }
  })
})

test.describe('Mentörlük telefonda alt menüde', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })
  test('mentörlüğü olan öğretmenin telefondaki alt menüsünde "Mentörlük" var', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 })
    await page.goto('/mentorluk')
    await page.getByRole('button', { name: '+ Öğrenci ekle' }).click()
    const ilk = page.locator('ul button').first()
    await expect(ilk).toBeVisible()
    const ad = (await ilk.locator('span').first().textContent())?.trim() ?? ''
    await ilk.click()
    await expect(page.locator('table').getByRole('link', { name: new RegExp(ad) })).toBeVisible({ timeout: 10_000 })
    try {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/anasayfa')
      const altMenu = page.locator('nav.fixed.bottom-0')
      // yalnız alt barın kendi linkleri (çekmece aynı nav içinde, ekran dışında duruyor)
      await expect(altMenu.locator(':scope > a', { hasText: 'Mentörlük' })).toBeVisible({ timeout: 15_000 })
    } finally {
      await page.setViewportSize({ width: 1280, height: 860 })
      await page.goto('/mentorluk')
      await page.locator('table').getByRole('link', { name: new RegExp(ad) }).click()
      await page.getByRole('button', { name: 'Listeden çıkar' }).click()
      await page.getByRole('button', { name: 'Çıkar' }).click()
      await expect(page).toHaveURL(/\/mentorluk$/, { timeout: 10_000 })
    }
  })
})

test.describe('Öğretmen aktivitesi ayıklanmış', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur_yardimcisi.json') })
  test('"Panele girdi" akışta yok; özet "Ödev Giren Öğretmen", tablo "Giriş günü" gösterir', async ({ page }) => {
    await page.goto('/rapor/ogretmen-aktivite')
    await expect(page.getByText('Ödev Giren Öğretmen')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('columnheader', { name: 'Giriş günü' })).toBeVisible()
    await expect(page.getByText('Panele girdi')).toHaveCount(0)
    await expect(page.getByText('Toplam Aktivite')).toHaveCount(0)
  })
})

// 2026-10-10 kullanıcı (iPhone): telefonda arama yoktu — masaüstü üst barı md altında gizli, mobil başlıkta düğme yoktu
test.describe('Telefonda arama', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json'), viewport: { width: 390, height: 844 }, hasTouch: true })

  test('üst başlıkta arama düğmesi var ve arama penceresini açar', async ({ page }) => {
    await page.goto('/anasayfa')
    const ara = page.getByRole('button', { name: 'Ara', exact: true })
    await expect(ara).toBeVisible({ timeout: 20_000 })
    const kutu = (await ara.boundingBox())!
    expect(kutu.width).toBeGreaterThanOrEqual(40) // dokunma hedefi
    await expect(async () => {
      await ara.tap()
      await expect(page.getByRole('dialog', { name: 'Arama' }).locator('input').first()).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    // iOS Safari 16px altı yazılı kutuya dokununca sayfayı yakınlaştırır
    const boyut = await page.getByRole('dialog', { name: 'Arama' }).locator('input').first()
      .evaluate(el => parseFloat(getComputedStyle(el).fontSize))
    expect(boyut).toBeGreaterThanOrEqual(16)
  })
})
