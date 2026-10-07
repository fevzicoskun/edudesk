import { test, expect, type Page, type Locator } from '@playwright/test'
import path from 'path'
const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)

/** Kutuları işaretler ve düğmenin etkinleşmesini bekler. SSR'da görünen kutu React bağlanmadan
 *  işaretlenirse state'e geçmez, düğme pasif kalır → toPass ile yeniden dener. */
async function secVeBekle(page: Page, kutular: Locator[], dugme: Locator) {
  await expect(async () => {
    for (const k of kutular) { await k.uncheck(); await k.check() }
    await expect(dugme).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
}

test.describe.serial('Mentör dağılımı', () => {
  let sinifUrl = ''
  let ogrenciAdlari: string[] = []
  let ogretmenAdi = ''

  test('MY iki öğrenciyi e2e öğretmenine atar', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('mudur_yardimcisi') })
    const page = await ctx.newPage()
    await page.goto('/siniflar')
    await page.locator('a[href^="/siniflar/"]').first().click()
    await page.waitForURL(/\/siniflar\/[0-9a-f-]{36}$/)
    sinifUrl = page.url()
    await page.getByText('Mentör Dağılımı').click()
    const kutular = page.locator('details input[type=checkbox]')
    ogrenciAdlari = await page.locator('details li span.flex-1').evaluateAll(els => els.slice(0, 2).map(e => e.textContent!.trim()))
    // e2e öğretmen hesabının adı ayarlardan değil select'ten seçilir: hesap adı test seed'inde sabit
    const secenek = page.locator('#mentor-sec option').filter({ hasText: 'PW Test ogretmen' }).first()
    ogretmenAdi = (await secenek.textContent())!.trim()
    const ata = page.getByRole('button', { name: /Seçilenlere ata/ })
    await expect(async () => {
      await page.selectOption('#mentor-sec', { label: ogretmenAdi })
      await secVeBekle(page, [kutular.nth(0), kutular.nth(1)], ata)
    }).toPass({ timeout: 40_000 })
    await ata.click()
    await expect(page.getByRole('status')).toHaveText('Atandı')
    await expect(page.locator('details li').filter({ hasText: ogrenciAdlari[0] })).toContainText(ogretmenAdi)
    await ctx.close()
  })

  test('öğretmen tabloda iki öğrenciyi görür; idare atamasını kaldıramaz', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen') })
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/mentorluk')
    for (const ad of ogrenciAdlari) await expect(page.getByRole('link', { name: ad })).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Mentörlük' })).toBeVisible()
    await page.getByRole('link', { name: ogrenciAdlari[0] }).click()
    await expect(page.getByText('İdare atadı')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Listeden çıkar' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Ödev durumu' })).toBeVisible()
    await ctx.close()
  })

  test('bozuk ?bas= dönem başına düşer, sayfa açılır', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen') })
    const page = await ctx.newPage()
    const res = await page.goto('/mentorluk?bas=abc')
    expect(res?.status()).toBe(200)
    await expect(page.locator('input[name=bas]')).not.toHaveValue('abc')
    await ctx.close()
  })

  test('hepsini yazdır öğrenci başına bir sayfa; tablo yatay', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen') })
    const page = await ctx.newPage()
    await page.goto('/mentorluk/yazdir')
    const n = await page.locator('section[aria-label]').count()
    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ preferCSSPageSize: true })
    const sayfa = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    expect(sayfa).toBe(n)
    await page.goto('/mentorluk/tablo')
    await page.emulateMedia({ media: 'print' })
    const tpdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1')
    const [, w, h] = tpdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/)!
    expect(Number(w)).toBeGreaterThan(Number(h))
    await ctx.close()
  })

  test('karanlık temada yazdırma sayfaları ekranda okunur (kontrast ≥ 4.5)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen'), colorScheme: 'dark' })
    const page = await ctx.newPage()
    // Metin rengi ile en yakın opak zemin arasındaki WCAG kontrastı
    const kontrast = (sel: string) => page.locator(sel).first().evaluate(el => {
      // Tailwind v4 oklch() döndürür — canvas her biçimi sRGB'ye çevirir
      const rgb = (c: string) => {
        const x = document.createElement('canvas').getContext('2d')!
        x.fillStyle = c; x.fillRect(0, 0, 1, 1)
        const [r, g, bb, a] = x.getImageData(0, 0, 1, 1).data
        return [r, g, bb, a / 255]
      }
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      let z: Element | null = el, bg = 'rgba(0, 0, 0, 0)'
      while (z) { bg = getComputedStyle(z).backgroundColor; if (rgb(bg)[3] > 0) break; z = z.parentElement }
      const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(bg))].sort((x, y) => y - x)
      return (a + 0.05) / (b + 0.05)
    })
    await page.goto('/mentorluk/yazdir')
    expect(await kontrast('section[aria-label] dd')).toBeGreaterThanOrEqual(4.5)
    await page.goto('/mentorluk/tablo')
    expect(await kontrast('tbody td')).toBeGreaterThanOrEqual(4.5)
    await ctx.close()
  })

  test('telefonda tablo yerine satır listesi, yatay taşma yok', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen'), viewport: { width: 375, height: 800 } })
    const page = await ctx.newPage()
    await page.goto('/mentorluk')
    const taşma = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(taşma).toBeLessThanOrEqual(0)
    await ctx.close()
  })

  test.afterAll(async ({ browser }) => {
    test.setTimeout(120_000)
    if (!sinifUrl || ogrenciAdlari.length === 0) return
    // Temizlik: canlı veride atama bırakma
    const ctx = await browser.newContext({ storageState: AUTH('mudur_yardimcisi') })
    const page = await ctx.newPage()
    await page.goto(sinifUrl)
    await page.getByText('Mentör Dağılımı').click()
    const kaldir = page.getByRole('button', { name: 'Mentörü kaldır' })
    await secVeBekle(page, ogrenciAdlari.map(ad => page.locator('details li').filter({ hasText: ad }).locator('input')), kaldir)
    await kaldir.click()
    await expect(page.getByRole('status')).toHaveText('Mentör kaldırıldı')
    await ctx.close()
  })
})
