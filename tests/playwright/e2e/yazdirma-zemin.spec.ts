import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-28: yazdırma zemini. globals.css '* { print-color-adjust: exact }' tüm zeminleri zorla
 * bastırıyordu: açık temada sayfa gri, karanlık temada rapor lacivert zemin üstüne siyah yazı
 * (okunamaz). Yazdırma her zaman açık temada ve beyaz zeminde olmalı; ekranda karanlık tema sürmeli.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const BASLIK = `E2EZEMIN${Date.now()}`
let classId = '', studentId = '', odevId = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogr = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogr).single()
  const { data: st } = await db.from('students').select('id, class_id').eq('school_id', p!.school_id).is('deleted_at', null).limit(1).single()
  classId = st!.class_id as string
  studentId = st!.id as string
  const { data: hw, error } = await db.from('homeworks').insert({
    teacher_id: ogr, school_id: p!.school_id, class_id: classId, subject: 'Test', title: BASLIK, is_template: false,
  }).select('id').single()
  if (error) throw error
  odevId = hw!.id as string
})

test.afterAll(async () => {
  if (!odevId) return
  await db.from('homework_submissions').delete().eq('homework_id', odevId)
  await db.from('homeworks').delete().eq('id', odevId)
})

const BEYAZ = 'rgb(255, 255, 255)'
/** Öğenin ve atalarının ilk opak zemini — kağıtta görünen renk */
const gorunenZemin = (page: Page, secici: string) => page.locator(secici).first().evaluate(el => {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const bg = getComputedStyle(e).backgroundColor
    if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
  }
  return 'rgb(255, 255, 255)'
})
/** Yazı rengi koyu mu (kağıtta okunur)? r+g+b < 300 */
const koyuYazi = (page: Page, secici: string) => page.locator(secici).first().evaluate(el => {
  const [r, g, b] = getComputedStyle(el).color.match(/\d+/g)!.map(Number)
  return r + g + b < 300
})

for (const tema of ['light', 'dark'] as const) {
  test(`yazdırmada zemin beyaz, rapor okunur — ${tema === 'dark' ? 'karanlık' : 'açık'} tema`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem('theme', t), tema)

    await page.goto(`/odevler/${odevId}`)
    await expect(page.getByRole('heading', { name: BASLIK }).first()).toBeAttached({ timeout: 20_000 })
    await page.emulateMedia({ media: 'print' })
    expect(await gorunenZemin(page, 'body')).toBe(BEYAZ)
    expect(await gorunenZemin(page, 'main')).toBe(BEYAZ)
    // yazdırılan rapor başlığı: beyaz zemin + koyu yazı
    const rapor = `h1:text-is("${BASLIK}")`
    expect(await gorunenZemin(page, rapor)).toBe(BEYAZ)
    expect(await koyuYazi(page, rapor)).toBe(true)

    await page.emulateMedia({ media: 'screen' })
    await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}/odev-raporu`)
    await expect(page.getByText('Öğrenci Ödev Özeti').first()).toBeVisible({ timeout: 20_000 })
    await page.emulateMedia({ media: 'print' })
    expect(await gorunenZemin(page, 'main')).toBe(BEYAZ)
    expect(await gorunenZemin(page, 'text=Derslere göre')).toBe(BEYAZ)
    expect(await koyuYazi(page, 'text=Derslere göre')).toBe(true)
  })
}

test('ekranda karanlık tema bozulmadı (yalnız yazdırma açık temaya döner)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}/odev-raporu`)
  await expect(page.getByText('Öğrenci Ödev Özeti').first()).toBeVisible({ timeout: 20_000 })
  await page.emulateMedia({ media: 'screen' })
  expect(await gorunenZemin(page, 'main')).not.toBe(BEYAZ)
  const [r, g, b] = (await gorunenZemin(page, 'main')).match(/\d+/g)!.map(Number)
  expect(r + g + b).toBeLessThan(200) // koyu zemin
})
