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
