import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/** 2026-10-11: veli iletişim kaydından imzalanabilir tutanak — bilgiler kayıttan ve öğrenciden dolar. */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const ETIKET = `E2ETUTANAK${Date.now()}`
let schoolId = '', classId = '', studentId = '', logId = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogretmenId = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  schoolId = p!.school_id as string
  const { data: c } = await db.from('students').select('class_id').eq('school_id', schoolId).is('deleted_at', null).limit(1).single()
  classId = c!.class_id as string
  const { data: s, error } = await db.from('students').insert({
    full_name: `${ETIKET} Öğrenci`, student_number: '4321', class_id: classId, school_id: schoolId,
    veli_ad: `${ETIKET} Veli`, veli_telefon: '0555 111 22 33',
  }).select('id').single()
  if (error) throw error
  studentId = s!.id as string
  const { data: l, error: e2 } = await db.from('parent_contact_logs').insert({
    school_id: schoolId, student_id: studentId, teacher_id: ogretmenId,
    note: `${ETIKET} ödev düzeni konuşuldu`, contact_method: 'yuz_yuze', contacted_at: '2026-10-08T09:00:00+03:00',
  }).select('id').single()
  if (e2) throw e2
  logId = l!.id as string
})

test.afterAll(async () => {
  if (studentId) await db.from('students').delete().eq('id', studentId) // log cascade ile gider
})

test('öğrenci sayfasından tutanak açılır; kayıt ve öğrenci bilgileri dolu gelir', async ({ page }) => {
  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}`)
  await page.getByRole('link', { name: 'Tutanak yazdır' }).click()
  await expect(page).toHaveURL(new RegExp(`/gorusme/${logId}$`), { timeout: 20_000 })

  const t = page.locator('article')
  await expect(t.getByRole('heading', { name: 'VELİ GÖRÜŞME TUTANAĞI' })).toBeVisible()
  await expect(t).toContainText(`${ETIKET} Öğrenci`)
  await expect(t).toContainText(`${ETIKET} Veli`)
  await expect(t).toContainText('0555 111 22 33')
  await expect(t).toContainText('4321')
  await expect(t).toContainText('Yüz Yüze')
  await expect(t).toContainText('8 Ekim 2026')
  await expect(t).toContainText(`${ETIKET} ödev düzeni konuşuldu`)
  await expect(t.getByText('İmza', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: /Yazdır/ })).toBeVisible()
})

test('başka öğrencinin adresiyle kayıt açılmaz', async ({ page }) => {
  const { data: baska } = await db.from('students').select('id').eq('class_id', classId).neq('id', studentId).is('deleted_at', null).limit(1).single()
  // loading.tsx streaming yüzünden notFound() HTTP 200 döner — içerikten doğrula
  await page.goto(`/siniflar/${classId}/ogrenciler/${baska!.id}/gorusme/${logId}`)
  await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(`${ETIKET} ödev düzeni konuşuldu`)).toHaveCount(0)
})
