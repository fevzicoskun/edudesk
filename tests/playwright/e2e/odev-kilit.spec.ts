import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-27: kontrolü bitmiş ödev kilitli açılır. Kullanıcı çıktı almak için
 * girip yanlışlıkla "Hepsi yaptı"ya basınca tüm kontrol geri dönüşsüz bozuluyordu.
 * Değiştirmek için "Değişiklik yap" → "Evet, değiştir" onayı gerekir (yalnız o ziyaret).
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

let hwId = ''
const baslik = `E2EKILIT${Date.now()}`

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
  // Kontrol bitmiş: sınıftaki herkes işaretli (hepsi "yapılmadı")
  const { data: ogr } = await db.from('students').select('id').eq('class_id', st!.class_id).is('deleted_at', null)
  const { error: e2 } = await db.from('homework_submissions').upsert(
    (ogr ?? []).map(o => ({
      homework_id: hwId, student_id: o.id, school_id: p!.school_id,
      status: 'yapilmadi', marked_at: new Date().toISOString(),
    })),
    { onConflict: 'homework_id,student_id' },
  )
  if (e2) throw e2
})

test.afterAll(async () => {
  if (!hwId) return
  await db.from('homework_submission_logs').delete().eq('homework_id', hwId)
  await db.from('homework_submissions').delete().eq('homework_id', hwId)
  await db.from('homeworks').delete().eq('id', hwId)
})

test.describe.configure({ mode: 'serial' })

const yapildiSayisi = async () => {
  const { count } = await db.from('homework_submissions')
    .select('id', { count: 'exact', head: true }).eq('homework_id', hwId).eq('status', 'yapildi')
  return count
}

async function ac(page: Page) {
  await page.goto(`/odevler/${hwId}`)
  await expect(page.getByRole('heading', { name: baslik })).toBeVisible()
  await expect(page.getByText('Bu ödev kontrol edildi')).toBeVisible()
}

test('kontrol edilmiş ödev kilitli açılır: hiçbir durum değişemez, Paylaş/Yazdır açık', async ({ page }) => {
  await ac(page)
  await expect(page.getByRole('button', { name: 'Hepsi yaptı' })).toHaveCount(0)
  const yapildi = page.getByRole('button', { name: 'Yapıldı', exact: true }).first()
  await expect(yapildi).toBeDisabled()
  await yapildi.click({ force: true })
  await page.waitForTimeout(1500)
  expect(await yapildiSayisi()).toBe(0)

  await expect(page.getByRole('button', { name: 'Paylaş' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Yazdır / PDF' })).toBeEnabled()
})

test('"Vazgeç" kilitli bırakır; "Evet, değiştir" kilidi açar ve değişiklik kaydedilir', async ({ page }) => {
  await ac(page)
  // SSR'da görünen düğme hidrasyondan önce tıklanırsa tık kaybolur → toPass
  await expect(async () => {
    await page.getByRole('button', { name: 'Değişiklik yap' }).click()
    await expect(page.getByText('Kontrol edilmiş ödevi değiştireceksin. Emin misin?')).toBeVisible({ timeout: 1000 })
  }).toPass()
  await page.getByRole('button', { name: 'Vazgeç' }).click()
  await expect(page.getByText('Bu ödev kontrol edildi')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yapıldı', exact: true }).first()).toBeDisabled()

  await page.getByRole('button', { name: 'Değişiklik yap' }).click()
  await page.getByRole('button', { name: 'Evet, değiştir' }).click()
  await expect(page.getByText('Bu ödev kontrol edildi')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hepsi yaptı' })).toBeVisible()

  await page.getByRole('button', { name: 'Yapıldı', exact: true }).first().click()
  await expect.poll(yapildiSayisi).toBe(1)
})

test('sayfaya yeniden girince yine kilitli', async ({ page }) => {
  await ac(page)
  await expect(page.getByRole('button', { name: 'Yapıldı', exact: true }).first()).toBeDisabled()
})
