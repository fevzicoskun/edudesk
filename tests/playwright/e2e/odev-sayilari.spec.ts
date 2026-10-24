/** Ödev sayıları sınıf mevcuduyla tutar (2026-10-24 canlı bulgu: eksik ve mazeretli metinde yazmıyordu,
 *  "8/18 yaptı" 22 kişilik sınıfta 4 kişiyi kaybediyordu). Yalnız __PW_TEST__ okuluna yazar, afterAll siler. */
import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { addDaysISO, todayLocalISO } from '@/src/shared/date'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const OGRETMEN = process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'
const BASLIK = `E2Esayi${Date.now()}`
let odevId = ''
let mevcut = 0

test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth', 'ogretmen.json') })

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogretmenId = u.users.find(x => x.email === OGRETMEN)!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  const { data: tc } = await db.from('teacher_classes').select('class_id').eq('teacher_id', ogretmenId)
  // En az 2 öğrencili sınıf: biri eksik işaretlenir, kalanı girilmedi kalır (mazeretli birim testte)
  let sinif = ''
  let ogrenciler: { id: string }[] = []
  for (const { class_id } of tc ?? []) {
    const { data } = await db.from('students').select('id').eq('class_id', class_id).is('deleted_at', null).order('id')
    if ((data ?? []).length >= 2) { sinif = class_id; ogrenciler = data!; break }
  }
  if (!sinif) throw new Error('test öğretmeninin en az 2 öğrencili sınıfı yok')
  mevcut = ogrenciler.length
  const bugun = todayLocalISO()
  const { data: hw, error } = await db.from('homeworks').insert({
    teacher_id: ogretmenId, class_id: sinif, school_id: p!.school_id, subject: 'Matematik', title: BASLIK,
    assigned_date: addDaysISO(bugun, -5), due_date: addDaysISO(bugun, -2),
  }).select('id').single()
  if (error) throw new Error(error.message)
  odevId = hw!.id
  const isaretle = (sid: string, status: string) => db.from('homework_submissions')
    .update({ status, marked_at: new Date().toISOString() }).eq('homework_id', odevId).eq('student_id', sid)
  await isaretle(ogrenciler[0].id, 'eksik')
})

test.afterAll(async () => {
  if (!odevId) return
  await db.from('homework_submissions').delete().eq('homework_id', odevId)
  await db.from('homeworks').delete().eq('id', odevId)
})

test('Ödevler kartı: eksik ve girilmedi yazılır; toplam = sınıf mevcudu', async ({ page }) => {
  await page.goto(`/odevler?q=${BASLIK}`)
  const kart = page.locator('p', { hasText: '· 1 eksik' }).first()
  await expect(kart).toBeVisible({ timeout: 20_000 })
  await expect(kart).toContainText(`· ${mevcut - 1} girilmedi`)
  const metin = (await kart.textContent()) ?? ''
  const toplam = [...metin.matchAll(/(\d+) (?:yaptı|eksik|geç|yapmadı|mazeretli|girilmedi)/g)].reduce((t, m) => t + Number(m[1]), 0)
  expect(toplam).toBe(mevcut)
})
