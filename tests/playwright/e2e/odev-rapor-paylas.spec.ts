import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-27: ödev kontrol raporu "Paylaş" → yazdırma raporunun PNG'si telefonun
 * paylaşım menüsüne (WhatsApp) gider; menü yoksa indirilir.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

let hwId = ''
const baslik = `E2EPAYLAS${Date.now()}`

test.beforeAll(async () => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogretmenId = data.users.find(u => u.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  const { data: st } = await db.from('students').select('class_id')
    .eq('school_id', p!.school_id).is('deleted_at', null).limit(1).single()
  const { data: hw, error } = await db.from('homeworks').insert({
    teacher_id: ogretmenId, title: baslik, school_id: p!.school_id,
    class_id: st!.class_id, subject: 'Test', is_template: false,
  }).select('id').single()
  if (error) throw error
  hwId = hw!.id
  // Resimde renkli durumlar da görünsün: ilk öğrenci yapmadı, ikincisi eksik
  const { data: ogr } = await db.from('students').select('id')
    .eq('class_id', st!.class_id).is('deleted_at', null).order('id')
  const durumlar = ['yapilmadi', 'eksik']
  const { error: e2 } = await db.from('homework_submissions').upsert(
    (ogr ?? []).slice(0, 2).map((o, i) => ({
      homework_id: hwId, student_id: o.id, school_id: p!.school_id,
      status: durumlar[i], marked_at: new Date().toISOString(),
    })),
    { onConflict: 'homework_id,student_id' },
  )
  if (e2) throw e2
})

test.afterAll(async () => {
  if (!hwId) return
  await db.from('homework_submissions').delete().eq('homework_id', hwId)
  await db.from('homeworks').delete().eq('id', hwId)
})

test.describe.configure({ mode: 'serial' })

/** PNG başlığından genişlik/yükseklik (IHDR) */
const pngBoyut = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) })

test('Paylaş: rapor PNG olarak paylaşım menüsüne gider', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __paylasilan?: { ad: string; tip: string; veri: string } }
    Object.assign(navigator, {
      canShare: (d: { files?: File[] }) => !!d.files?.length,
      share: async (d: { files: File[] }) => {
        const f = d.files[0]
        const bytes = new Uint8Array(await f.arrayBuffer())
        let bin = ''
        bytes.forEach(b => { bin += String.fromCharCode(b) })
        w.__paylasilan = { ad: f.name, tip: f.type, veri: btoa(bin) }
      },
    })
  })
  await page.goto(`/odevler/${hwId}`)
  await expect(page.getByRole('heading', { name: baslik })).toBeVisible()

  await expect(async () => {
    await page.getByRole('button', { name: 'Paylaş' }).click()
    await expect.poll(() => page.evaluate(() => !!(window as unknown as { __paylasilan?: unknown }).__paylasilan), { timeout: 15_000 }).toBe(true)
  }).toPass({ timeout: 60_000 })

  const p = await page.evaluate(() => (window as unknown as { __paylasilan: { ad: string; tip: string; veri: string } }).__paylasilan)
  expect(p.tip).toBe('image/png')
  expect(p.ad).toMatch(/^odev-raporu-.+-\d{4}-\d{2}-\d{2}\.png$/)

  const png = Buffer.from(p.veri, 'base64')
  const { w, h } = pngBoyut(png)
  expect(w).toBeGreaterThanOrEqual(1500)   // A4 genişliği ×2 ölçek
  expect(h).toBeGreaterThan(300)           // boş/sıfır boyutlu değil
  fs.mkdirSync('test-results', { recursive: true })
  fs.writeFileSync('test-results/odev-rapor-paylas.png', png)

  await expect(page.getByRole('button', { name: 'Paylaş' })).toBeEnabled()
  await expect(page.getByText('Rapor resmi oluşturulamadı')).toHaveCount(0)
})

test('paylaşım menüsü yoksa PNG indirilir', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(navigator, { canShare: undefined, share: undefined })
  })
  await page.goto(`/odevler/${hwId}`)
  await expect(page.getByRole('heading', { name: baslik })).toBeVisible()

  const indirme = await (async () => {
    let sonuc
    await expect(async () => {
      const bekle = page.waitForEvent('download', { timeout: 15_000 })
      await page.getByRole('button', { name: 'Paylaş' }).click()
      sonuc = await bekle
    }).toPass({ timeout: 60_000 })
    return sonuc!
  })()
  expect((indirme as { suggestedFilename(): string }).suggestedFilename()).toMatch(/^odev-raporu-.+\.png$/)
})
