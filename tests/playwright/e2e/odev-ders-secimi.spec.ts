import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-10-18: Ödev formunda ders serbest metin değil.
 *  - Dersler öğretmenin ders programından (sınıf bazında; "Matematik 1"/"S-MAT" → Matematik, Mentörlük ders değil).
 *  - Birden çok ders → tek seçimli düğmeler; en son seçilen sınıfta tek ders veriyorsa o seçili gelir,
 *    elle seçilen ders sınıf değişince korunur. Tek ders → kilitli etiket.
 *  - Düzenlemede ödevin listede olmayan eski dersi seçili kalır ve kaydedilir (eski ödevler bozulmaz).
 * Test öğretmenine geçici program + ikinci sınıf kurulur, sonda silinir.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })
test.describe.configure({ mode: 'serial' })

const ETIKET = `E2Eders${Date.now()}`
/** İstanbul günü + n gün (YYYY-MM-DD) */
const gun = (n: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + n * 864e5))
let ogretmenId = '', schoolId = '', sinifA = '', sinifB = '', sinifAAdi = '', sinifBAdi = ''

async function program(slots: { subject: string; class_id: string }[]) {
  const { error } = await db.from('lesson_schedules').upsert({
    teacher_id: ogretmenId, school_id: schoolId,
    slots: slots.map((s, i) => ({ day: 1, period: i + 1, ...s })),
  }, { onConflict: 'school_id,teacher_id' })
  if (error) throw error
}

/** React devralmadan tıklanan düğme etkisiz kalır (yavaş hydration) */
async function formHazir(page: Page) {
  await expect.poll(() => page.locator('input[name="title"]').evaluate(el =>
    Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 30_000 }).toBe(true)
}

const ders = (page: Page, ad: string) => page.getByRole('group', { name: 'Ders' }).getByRole('button', { name: ad, exact: true })
const sinif = (page: Page, ad: string) => page.getByRole('button', { name: ad, exact: true })

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  ogretmenId = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  schoolId = p!.school_id as string
  const { data: mevcut } = await db.from('classes').select('id, name').eq('school_id', schoolId).is('deleted_at', null).order('name').limit(1).single()
  sinifA = mevcut!.id as string; sinifAAdi = mevcut!.name as string
  const { data: yeni, error } = await db.from('classes').insert({ school_id: schoolId, name: `${ETIKET}-B`, grade: 10 }).select('id, name').single()
  if (error) throw error
  sinifB = yeni!.id as string; sinifBAdi = yeni!.name as string
  const { data: var_ } = await db.from('lesson_schedules').select('id').eq('teacher_id', ogretmenId).maybeSingle()
  if (var_) throw new Error('test öğretmeninin gerçek programı var — test onu silerdi')
})

test.afterAll(async () => {
  const { data } = await db.from('homeworks').select('id').like('title', `${ETIKET}%`)
  const ids = (data ?? []).map(h => h.id)
  if (ids.length) {
    await db.from('homework_submissions').delete().in('homework_id', ids)
    await db.from('homeworks').delete().in('id', ids)
  }
  await db.from('lesson_schedules').delete().eq('teacher_id', ogretmenId)
  await db.from('classes').delete().eq('id', sinifB)
})

test('çok ders: düğmeler, sınıfa göre ön seçim, elle seçim korunur, kayıt seçilen dersle', async ({ page }) => {
  // A: yalnız Geometri (+ ders olmayan Mentörlük) · B: Matematik 1 + S-MAT → Matematik
  await program([
    { subject: 'Geometri', class_id: sinifA }, { subject: 'Mentörlük', class_id: sinifA },
    { subject: 'Matematik 1', class_id: sinifB }, { subject: 'S-MAT', class_id: sinifB },
  ])
  await page.goto('/odevler/yeni')
  await formHazir(page)

  const grup = page.getByRole('group', { name: 'Ders' })
  await expect(grup.getByRole('button')).toHaveCount(2) // Geometri, Matematik — Mentörlük yok, S-MAT/Matematik 1 tekil
  await expect(page.locator('select[name="subject"], input[name="subject"][type="text"]')).toHaveCount(0)
  await expect(ders(page, 'Geometri')).toHaveAttribute('aria-pressed', 'false')

  await sinif(page, sinifAAdi).click()
  await expect(ders(page, 'Geometri')).toHaveAttribute('aria-pressed', 'true')
  await sinif(page, sinifBAdi).click()            // en son seçilen B → Matematik
  await expect(ders(page, 'Matematik')).toHaveAttribute('aria-pressed', 'true')
  await sinif(page, sinifBAdi).click()            // B kalktı → son sınıf A → Geometri
  await expect(ders(page, 'Geometri')).toHaveAttribute('aria-pressed', 'true')

  await ders(page, 'Matematik').click()           // elle seçim
  await sinif(page, sinifBAdi).click()
  await sinif(page, sinifBAdi).click()            // sınıf değişti ama elle seçim korunur
  await expect(ders(page, 'Matematik')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('input[name="subject"]')).toHaveValue('Matematik')

  await page.locator('input[name="title"]').fill(`${ETIKET} çok ders`)
  await page.getByRole('button', { name: '1 hafta', exact: true }).click()
  await page.locator('button[type="submit"]').last().click()
  await expect(page).toHaveURL(/\/odevler\/[0-9a-f-]{36}/, { timeout: 30_000 })
  const { data } = await db.from('homeworks').select('subject').like('title', `${ETIKET}%`).single()
  expect(data!.subject).toBe('Matematik')
})

test('tek ders: kilitli etiket, seçim düğmesi/listesi yok', async ({ page }) => {
  await program([{ subject: 'S-KİM', class_id: sinifA }, { subject: 'Kimya', class_id: sinifB }])
  await page.goto('/odevler/yeni')
  await formHazir(page)
  await expect(page.getByText('Kimya', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('group', { name: 'Ders' })).toHaveCount(0)
  await expect(page.locator('select[name="subject"]')).toHaveCount(0)
  await expect(page.locator('input[type="hidden"][name="subject"]')).toHaveValue('Kimya')
})

test('düzenleme: listede olmayan eski ders seçili kalır ve kaydedilir', async ({ page }) => {
  await program([{ subject: 'Geometri', class_id: sinifA }, { subject: 'Matematik', class_id: sinifA }])
  const { data: hw, error } = await db.from('homeworks').insert({
    teacher_id: ogretmenId, school_id: schoolId, class_id: sinifA, title: `${ETIKET} Eski Ders`,
    subject: 'Edebiyat', due_date: gun(7), assigned_date: gun(0), // verildiği gün gelecekte olamaz
  }).select('id').single()
  if (error) throw error
  await page.goto(`/odevler/${hw!.id}/duzenle`)
  await formHazir(page)
  await expect(ders(page, 'Edebiyat')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('input[name="subject"]')).toHaveValue('Edebiyat')
  // sayfada hızlı ekleme çekmecesinin düğmeleri de var → formun düğmesi adıyla
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/odevler/${hw!.id}(\\?|$)`), { timeout: 30_000 })
  const { data } = await db.from('homeworks').select('subject').eq('id', hw!.id).single()
  expect(data!.subject).toBe('Edebiyat')
})

test('hızlı ekleme çekmecesi: ders düğmeyle seçilir, ödev o dersle kaydedilir', async ({ page }) => {
  await program([{ subject: 'Geometri', class_id: sinifA }, { subject: 'Matematik', class_id: sinifB }])
  await page.goto('/odevler')
  const fab = page.getByRole('button', { name: 'Hızlı ödev ekle' })
  const grup = page.getByRole('group', { name: 'Ders' })
  await expect(async () => {
    await fab.first().click({ timeout: 2_000 })
    await expect(grup).toBeVisible({ timeout: 2_000 }) // dersler açılınca yüklenir
  }).toPass({ timeout: 30_000 })
  await expect(grup.getByRole('button')).toHaveCount(2)

  await page.getByRole('button', { name: sinifBAdi, exact: true }).last().click() // B'de yalnız Matematik → ön seçili
  await expect(ders(page, 'Matematik')).toHaveAttribute('aria-pressed', 'true')
  await ders(page, 'Geometri').click()                                           // elle değiştir
  await page.getByPlaceholder('Örn: Sayfa 45–47 soruları').fill(`${ETIKET} çekmece`)
  await page.getByRole('group', { name: 'Hızlı teslim tarihi' }).getByRole('button', { name: '1 hafta', exact: true }).click()
  await page.getByRole('button', { name: 'Ödevi Oluştur' }).click()

  await expect.poll(async () => (await db.from('homeworks').select('subject').eq('title', `${ETIKET} Çekmece`).maybeSingle()).data?.subject,
    { timeout: 30_000 }).toBe('Geometri')
})
