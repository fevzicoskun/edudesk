import { test, expect, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// Öğretmen isteği 2026-10-19: ders programı telefonda Fotoğraflar'a. Resmi sunucu çizer (/api/ders-programi/gorsel).
// Test öğretmeninin programı doldurulup kaydedilir, sonda boşaltılır (test okulu).
test.use({ storageState: 'tests/playwright/.auth/ogretmen.json', viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true })
test.describe.configure({ mode: 'serial' })

async function programiKaydet(page: Page, doldur: boolean) {
  await page.goto('/ders-programi')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Düzenle' }).click()
  const sel = page.locator('table select')
  const n = await sel.count()
  for (let i = 0; i < n; i++) {
    // Son iki saat boş: görselde sondaki boş saatler kırpılır
    if (doldur && i % 4 !== 3 && i < n - 10) await sel.nth(i).selectOption({ index: 1 })
    else await sel.nth(i).selectOption('')
  }
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByText('Ders programın kaydedildi.')).toBeVisible()
}

test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'tests/playwright/.auth/ogretmen.json' })
  await programiKaydet(await ctx.newPage(), false)
  await ctx.close()
})

test('telefonda Fotoğraflara kaydet sunucunun çizdiği PNG paylaşır', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    ;(navigator as unknown as { canShare: () => boolean }).canShare = () => true
    ;(navigator as unknown as { share: (d: { files: File[] }) => Promise<void> }).share = async d => {
      const f = d.files[0]
      const b = new Uint8Array(await f.arrayBuffer())
      let s = ''
      for (const x of b) s += String.fromCharCode(x)
      ;(window as unknown as { __paylasilan: unknown }).__paylasilan = { ad: f.name, tip: f.type, b64: btoa(s) }
    }
  })
  await programiKaydet(page, true)
  const btn = page.getByRole('button', { name: 'Fotoğraflara kaydet' })
  await expect(btn).toBeEnabled({ timeout: 20000 })
  await btn.click()
  const p = (await page.waitForFunction(() => (window as unknown as { __paylasilan?: unknown }).__paylasilan).then(h => h.jsonValue())) as { ad: string; tip: string; b64: string }
  expect(p.ad).toBe('ders-programi.png')
  expect(p.tip).toBe('image/png')
  const png = Buffer.from(p.b64, 'base64')
  expect(png.readUInt32BE(16)).toBe(1080) // PNG genişliği: telefon ekranı değil, görsel şablonu
  writeFileSync(testInfo.outputPath('ders-programi.png'), png)
})

test('paylaşım yoksa resim indirilir', async ({ page }) => {
  await page.addInitScript(() => { ;(navigator as unknown as { canShare?: unknown }).canShare = undefined })
  await page.goto('/ders-programi')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Resim olarak indir' }).click()])
  expect(dl.suggestedFilename()).toBe('ders-programi.png')
})
