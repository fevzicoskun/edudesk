import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-28: yazdırılan sayfalarda tarayıcı başlığı kağıda basılır ("… · EduDesk" yazıyordu).
 * Yazdırılan sayfaların başlığı sitenin adresiyle bitmeli: "… · myedudesk.com.tr".
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const BASLIK = `E2EBASLIK${Date.now()}`
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

const sayfalar = () => [
  { ad: 'ödev kontrol raporu', url: `/odevler/${odevId}`, bekle: BASLIK },
  { ad: 'sınıf ödev matrisi', url: `/odevler/sinif/${classId}`, bekle: 'Ödev Matrisi' },
  { ad: 'sınıf toplu özet', url: `/siniflar/${classId}/odev-raporu`, bekle: 'Sınıf Ödev Özetleri' },
  { ad: 'öğrenci özeti', url: `/siniflar/${classId}/ogrenciler/${studentId}/odev-raporu`, bekle: 'Öğrenci Ödev Özeti' },
]

test('yazdırılan sayfaların başlığı "· myedudesk.com.tr" ile biter, EduDesk yazmaz', async ({ page }) => {
  for (const s of sayfalar()) {
    await page.goto(s.url)
    await expect(page, s.ad).toHaveTitle(new RegExp(`${s.bekle}.* · myedudesk\.com\.tr$`), { timeout: 20_000 })
    expect(await page.title(), s.ad).not.toMatch(/EduDesk/)
  }
})

test('yazdırılmayan sayfalar marka adını korur', async ({ page }) => {
  await page.goto('/anasayfa')
  await expect(page).toHaveTitle(/EduDesk/, { timeout: 20_000 })
})
