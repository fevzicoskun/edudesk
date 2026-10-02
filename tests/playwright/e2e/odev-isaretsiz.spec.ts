import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-30: Kontrol edilmemiş ödevde işaretlenmemiş öğrenciler kırmızı "Yapılmadı" görünüyordu
 * (satır varsayılan 'yapilmadi' alıyordu) ve "Ailelere Ulaş" onları velisine yazılacaklar listesine koyuyordu.
 * İşaretsiz öğrenci: nötr "İşaretlenmedi", hiçbir durum düğmesi basılı değil, veli listesinde yok.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const BASLIK = `E2EISARETSIZ${Date.now()}`
let hwId = ''
let ogrenci = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogretmenId = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  const { data: st } = await db.from('students').select('id, full_name, class_id')
    .eq('school_id', p!.school_id).is('deleted_at', null).order('full_name').limit(1).single()
  ogrenci = st!.full_name as string
  const { data, error } = await db.from('homeworks').insert({
    teacher_id: ogretmenId, school_id: p!.school_id, class_id: st!.class_id, title: BASLIK,
    subject: 'Test', is_template: false,
    assigned_date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - 5 * 86_400_000)),
    due_date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - 2 * 86_400_000)), // İstanbul günü
  }).select('id').single()
  if (error) throw error
  hwId = data!.id
})

test.afterAll(async () => {
  if (!hwId) return
  await db.from('homework_submission_logs').delete().eq('homework_id', hwId)
  await db.from('homework_submissions').delete().eq('homework_id', hwId)
  await db.from('homeworks').delete().eq('id', hwId)
})

test('masaüstü: işaretsiz öğrencide hiçbir durum basılı değil, veli listesinde yok', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/odevler/${hwId}`)
  const satir = page.locator('div', { has: page.getByText(ogrenci, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Yapılmadı', exact: true }) }).last()
  await expect(satir.getByRole('button', { name: 'Yapılmadı', exact: true })).toHaveAttribute('aria-pressed', 'false', { timeout: 20_000 })
  await expect(satir.getByRole('button', { name: 'Yapıldı', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Teslim etmemiş öğrenci yok')).toBeVisible()
})

test('telefon: işaretsiz öğrenci "İşaretlenmedi"; ilk dokunuş Yapıldı ve kalıcı', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/odevler/${hwId}`)
  const dongu = page.locator('button.md\\:hidden', { hasText: 'İşaretlenmedi' }).first()
  await expect(dongu).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('button.md\\:hidden', { hasText: /^Yapılmadı/ })).toHaveCount(0)

  // toPass: SSR'da görünen buton hydration bitmeden tıklanırsa tıklama kaybolur (bkz. DERS 2026-09-09)
  await expect(async () => {
    await dongu.click()
    await expect(page.locator('button.md\\:hidden', { hasText: /^Yapıldı/ }).first()).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })

  await expect.poll(async () => {
    const { data } = await db.from('homework_submissions').select('status, marked_at').eq('homework_id', hwId).not('marked_at', 'is', null)
    return (data ?? []).map(r => r.status)
  }, { timeout: 15_000 }).toEqual(['yapildi'])

  await page.reload()
  await expect(page.locator('button.md\\:hidden', { hasText: /^Yapıldı/ }).first()).toBeVisible({ timeout: 20_000 })
})
