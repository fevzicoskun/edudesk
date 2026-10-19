import { test, expect } from '@playwright/test'
// Öğretmen isteği 2026-10-19: ders programı Fotoğraflar'a. Program kaydedilmeden doldurulur → DB'ye yazılmaz.
test.use({ storageState: 'tests/playwright/.auth/ogretmen.json', viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true })
test('telefonda Fotoğraflara kaydet PNG paylaşır', async ({ page }) => {
  await page.addInitScript(() => {
    ;(navigator as any).canShare = () => true
    ;(navigator as any).share = async (d: { files: File[] }) => {
      const f = d.files[0]
      const b = new Uint8Array(await f.arrayBuffer())
      let s = ''; for (const x of b) s += String.fromCharCode(x)
      ;(window as any).__paylasilan = { ad: f.name, tip: f.type, b64: btoa(s) }
    }
  })
  await page.goto('/ders-programi')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Düzenle' }).click()
  const sel = page.locator('table select')
  const n = await sel.count()
  for (let i = 0; i < n; i++) { if (i % 4 !== 3) await sel.nth(i).selectOption({ index: 1 }) }
  await page.getByRole('button', { name: 'Görüntüle' }).click()
  const btn = page.getByRole('button', { name: 'Fotoğraflara kaydet' })
  await expect(btn).toBeEnabled({ timeout: 20000 })
  await btn.click()
  const p = await page.waitForFunction(() => (window as any).__paylasilan).then(h => h.jsonValue()) as any
  expect(p.ad).toBe('ders-programi.png')
  expect(p.tip).toBe('image/png')
  expect(p.b64.length).toBeGreaterThan(10000)
})
test('paylaşım yoksa resim indirilir', async ({ page }) => {
  await page.addInitScript(() => { ;(navigator as any).canShare = undefined })
  await page.goto('/ders-programi')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Düzenle' }).click()
  await page.locator('table select').first().selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Görüntüle' }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Resim olarak indir' }).click()])
  expect(dl.suggestedFilename()).toBe('ders-programi.png')
})
