import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { addDaysISO, todayLocalISO } from '@/src/shared/date'

/** 2026-11-10: mentör listesinde öğrenci adının altında "Son 7 günde N ödev yapılmadı · Ders N" satırı.
 *  Pencere teslim tarihine göre; pencere dışı (8 gün önce) ödev sayılmaz. */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const OGRETMEN = process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'

let ogrId = '', mentor = { id: '', school_id: '' }, odevIds: string[] = []

test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth', 'ogretmen.json') })

test.beforeAll(async () => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const uid = data.users.find(u => u.email === OGRETMEN)!.id
  const { data: p } = await db.from('profiles').select('id, school_id').eq('id', uid).single()
  mentor = p!
  const { data: alinan } = await db.from('mentorships').select('student_id').eq('school_id', mentor.school_id)
  const dolu = new Set((alinan ?? []).map(r => r.student_id))
  const { data: ogr } = await db.from('students').select('id, class_id').eq('school_id', mentor.school_id).is('deleted_at', null).limit(200)
  const o = ogr!.find(s => !dolu.has(s.id))!
  ogrId = o.id
  await db.from('mentorships').insert({ school_id: mentor.school_id, mentor_id: mentor.id, student_id: ogrId, assigned_by: mentor.id })

  const bugun = todayLocalISO()
  const odev = (subject: string, title: string, due_date: string) =>
    ({ teacher_id: mentor.id, class_id: o.class_id, school_id: mentor.school_id, subject, title, due_date, assigned_date: addDaysISO(due_date, -3) })
  const { data: eklenen, error } = await db.from('homeworks').insert([
    odev('Fizik', 'E2E uyarı 1', bugun),
    odev('Fizik', 'E2E uyarı 2', addDaysISO(bugun, -6)),   // pencerenin son günü
    odev('Kimya', 'E2E uyarı 3', addDaysISO(bugun, -2)),
    odev('Kimya', 'E2E uyarı dışı', addDaysISO(bugun, -7)), // pencere dışı
  ]).select('id')
  if (error) throw new Error(error.message)
  odevIds = eklenen!.map(h => h.id)
  const { error: e2 } = await db.from('homework_submissions').update({ status: 'yapilmadi', marked_at: new Date().toISOString() })
    .eq('student_id', ogrId).in('homework_id', odevIds)
  if (e2) throw new Error(e2.message)
})

test.afterAll(async () => {
  await db.from('homework_submissions').delete().in('homework_id', odevIds)
  await db.from('homeworks').delete().in('id', odevIds)
  await db.from('mentorships').delete().eq('student_id', ogrId).eq('mentor_id', mentor.id)
})

test('öğrenci adının altında son 7 gün uyarısı; pencere dışı ödev sayılmaz', async ({ page }) => {
  await page.goto('/mentorluk')
  await expect(page.getByRole('heading', { name: 'Mentörlüğüm' })).toBeVisible({ timeout: 20_000 })
  // masaüstü tablo + telefon kartı ikiz içerik → ilkini al
  await expect(page.getByText('Son 7 günde 3 ödev yapılmadı · Fizik 2, Kimya 1').first()).toBeVisible()
})
