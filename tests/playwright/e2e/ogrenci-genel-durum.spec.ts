import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-28: "Genel Durum" rozeti 5 kontrol edilmiş ödevden önce hüküm vermez.
 * Kendi öğrencisini yaratır — sınıftaki diğer test verisinden bağımsız, sayılar kesin.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const ETIKET = `E2EDURUM${Date.now()}`
const hwIds: string[] = []
let ogretmenId = '', schoolId = '', classId = '', studentId = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  ogretmenId = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  schoolId = p!.school_id as string
  const { data: c } = await db.from('students').select('class_id').eq('school_id', schoolId).is('deleted_at', null).limit(1).single()
  classId = c!.class_id as string
  const { data: s, error } = await db.from('students')
    .insert({ full_name: `${ETIKET} Öğrenci`, class_id: classId, school_id: schoolId }).select('id').single()
  if (error) throw error
  studentId = s!.id as string
})

test.afterAll(async () => {
  if (hwIds.length) {
    await db.from('homework_submissions').delete().in('homework_id', hwIds)
    await db.from('homeworks').delete().in('id', hwIds)
  }
  if (studentId) {
    await db.from('homework_submissions').delete().eq('student_id', studentId)
    await db.from('students').delete().eq('id', studentId)
  }
})

/** n adet ödev ekler ve bu öğrenci için "yapılmadı" işaretler */
async function yapilmamisOdevEkle(n: number) {
  const { data, error } = await db.from('homeworks').insert(Array.from({ length: n }, (_, i) => ({
    teacher_id: ogretmenId, school_id: schoolId, class_id: classId, subject: 'Test',
    title: `${ETIKET} ${hwIds.length + i + 1}`, is_template: false,
  }))).select('id')
  if (error) throw error
  const yeni = data!.map(h => h.id as string)
  hwIds.push(...yeni)
  const { error: e2 } = await db.from('homework_submissions')
    .upsert(yeni.map(homework_id => ({ homework_id, student_id: studentId, school_id: schoolId, status: 'yapilmadi', marked_at: new Date().toISOString() })),
      { onConflict: 'homework_id,student_id' })
  if (e2) throw e2
}

test('az ödevle "Risk" damgası yok; 5 kontrol edilmiş ödevden sonra kural çalışır', async ({ page }) => {
  const perf = page.locator('div', { has: page.getByRole('heading', { name: 'Performans Özeti' }) }).last()

  await yapilmamisOdevEkle(1) // %0 ama 1 ödev
  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}`)
  await expect(perf.getByText('Henüz az ödev', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(perf.getByText('5 ödev kontrol edilince değerlendirilir')).toBeVisible()
  await expect(perf.getByText('Risk', { exact: true })).toHaveCount(0)

  await yapilmamisOdevEkle(4) // toplam 5, hepsi yapılmadı → %0
  await page.reload()
  await expect(perf.getByText('Risk', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(perf.getByText('Henüz az ödev', { exact: true })).toHaveCount(0)
})
