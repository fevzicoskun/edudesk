import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { addDaysISO, todayLocalISO } from '@/src/shared/date'
import { haftaBasi } from '@/src/domains/mentor/takip/takipMath'

// Spec 2026-10-21: çalışma saatleri öğrenciye ait; okul ödevleri plana otomatik gelir.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)
const OGRETMEN = process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'
const BUGUN = todayLocalISO(), HAFTA = haftaBasi(BUGUN)

let mentor = { id: '', school_id: '' }
let A = '', B = '', sinifA = ''
const odevIds: string[] = []

test.describe.configure({ mode: 'serial' })
test.use({ storageState: AUTH('ogretmen') })

test.beforeAll(async () => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const id = data.users.find(u => u.email === OGRETMEN)!.id
  mentor = (await db.from('profiles').select('id, school_id').eq('id', id).single()).data!
  const { data: alinan } = await db.from('mentorships').select('student_id').eq('school_id', mentor.school_id)
  const dolu = new Set((alinan ?? []).map(r => r.student_id))
  const { data: ogr } = await db.from('students').select('id, class_id').eq('school_id', mentor.school_id).is('deleted_at', null).limit(300)
  const bos = ogr!.filter(o => !dolu.has(o.id))
  ;[A, B] = [bos[0].id, bos[1].id]; sinifA = bos[0].class_id
  await db.from('mentorships').insert([A, B].map(student_id => ({ school_id: mentor.school_id, mentor_id: mentor.id, student_id, assigned_by: mentor.id })))
  await db.from('mentor_takip_kullanicilari').upsert({ user_id: mentor.id, school_id: mentor.school_id })
})

test.afterAll(async () => {
  for (const s of [A, B]) {
    await db.from('mentor_haftalari').delete().eq('student_id', s)
    await db.from('ogrenci_calisma_saatleri').delete().eq('student_id', s)
    await db.from('mentorships').delete().eq('student_id', s).eq('mentor_id', mentor.id)
  }
  if (odevIds.length) {
    await db.from('homework_submissions').delete().in('homework_id', odevIds)
    await db.from('homeworks').delete().in('id', odevIds)
  }
  await db.from('mentor_takip_kullanicilari').delete().eq('user_id', mentor.id)
})

const kaydedildi = (page: Page) => expect(page.getByRole('status').filter({ hasText: 'Kaydedildi' })).toBeVisible({ timeout: 15_000 })
const saatYaz = async (page: Page, ogr: string, bas: string, bit: string) => {
  await page.goto(`/mentorluk/${ogr}/takip?hafta=${HAFTA}&sekme=dosya`)
  const kart = page.getByRole('region', { name: 'Çalışma saatleri' })
  // Hidrasyondan önce yazılan değer React'çe sıfırlanır → değer oturana kadar tekrar
  await expect(async () => {
    await kart.getByLabel('Pzt başlangıç').fill(bas)
    await kart.getByLabel('Pzt bitiş').fill(bit)
    await expect(kart.getByLabel('Pzt başlangıç')).toHaveValue(bas, { timeout: 500 })
  }).toPass({ timeout: 20_000 })
  await kart.getByRole('button', { name: 'Hafta içi hepsine uygula' }).click()
  await kart.getByRole('button', { name: 'Kaydet' }).click()
  await expect(kart.getByRole('status')).toHaveText('Çalışma saatleri kaydedildi.')
}

test('saatler öğrenciye ait: "tüm mentör öğrencilerime uygula" saatlere dokunmaz', async ({ page }) => {
  await saatYaz(page, A, '18:00', '20:30')
  await expect(page.getByRole('region', { name: 'Çalışma saatleri' }).getByText('Çar: 2 sa 30 dk')).toBeVisible()
  await saatYaz(page, B, '19:00', '21:00')
  const once = (await db.from('ogrenci_calisma_saatleri').select('student_id, gunler').in('student_id', [A, B]).order('student_id')).data

  await page.goto(`/mentorluk/${A}/takip?hafta=${HAFTA}`)
  await page.getByRole('button', { name: 'Normal' }).click()
  await kaydedildi(page)
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Bu planı tüm mentör öğrencilerime uygula' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'öğrenciye uygulandı' })).toBeVisible({ timeout: 20_000 })

  expect((await db.from('ogrenci_calisma_saatleri').select('student_id, gunler').in('student_id', [A, B]).order('student_id')).data).toEqual(once)
  await page.goto(`/mentorluk/${B}/takip?hafta=${HAFTA}&sekme=dosya`)
  await expect(page.getByRole('region', { name: 'Çalışma saatleri' }).getByLabel('Sal başlangıç')).toHaveValue('19:00')
})

test('gün başlığı planlanan / müsait; aşımda "fazla" uyarısı', async ({ page }) => {
  await page.goto(`/mentorluk/${A}/takip?hafta=${HAFTA}`)
  const program = page.getByRole('region', { name: 'Program' })
  // Sınıfın gerçek ödevleri de plana girebilir → kesin sayı yerine biçim + aşım. Cmt saati yok, şablonda Cmt görevi var.
  await expect(program.getByRole('heading', { name: /^Cmt · .+ \/ 0 dk · Çalışma saati yok$/ })).toBeVisible()
  await expect(program.getByRole('heading', { name: /^Pzt · .+ \/ 2 sa 30 dk$/ })).toBeVisible()
  await program.getByRole('button', { name: '+ Pzt görevi ekle' }).click()
  const pzt = program.locator('div.mt-2').filter({ has: page.getByRole('heading', { name: /^Pzt/ }) })
  await pzt.getByLabel('Görev', { exact: true }).last().fill('E2E uzun görev')
  await pzt.getByLabel('Miktar').last().fill('600')
  await kaydedildi(page)
  await expect(program.getByRole('heading', { name: /^Pzt · .+ \/ 2 sa 30 dk · .+ fazla$/ })).toBeVisible()
})

test('okul ödevi plana gelir; silinince geri gelmez; öğretmen işaretleyince yapıldı', async ({ page }) => {
  const yarin = addDaysISO(BUGUN, 1)
  const { data: hw, error } = await db.from('homeworks').insert({
    teacher_id: mentor.id, class_id: sinifA, school_id: mentor.school_id, subject: 'Kimya', title: 'E2E orbital ödevi', due_date: yarin, assigned_date: BUGUN,
  }).select('id').single()
  if (error) throw new Error(error.message)
  odevIds.push(hw!.id)

  await page.goto(`/mentorluk/${A}/takip?hafta=${HAFTA}`)
  const satir = page.getByRole('region', { name: 'Program' }).getByLabel('Ödev: Kimya — E2E orbital ödevi')
  await expect(satir).toBeVisible({ timeout: 20_000 })
  await expect(satir.getByText('yarın teslim')).toBeVisible()
  await expect(satir.getByLabel('Gün')).toHaveValue(String(Math.min(6, (Date.parse(BUGUN) - Date.parse(HAFTA)) / 86_400_000)))

  // Görev planda KAYITLI olsun (kaydedilmemiş birleşmede yapılmış ödev hiç eklenmez — kural gereği)
  await satir.getByLabel('Miktar').fill('35')
  await kaydedildi(page)
  // Öğretmen "yapıldı" → görev yapıldı
  await db.from('homework_submissions').update({ status: 'yapildi', marked_at: new Date().toISOString() }).eq('homework_id', hw!.id).eq('student_id', A)
  await page.reload()
  await expect(satir.getByText('✓ yapıldı (öğretmen işaretledi)')).toBeVisible({ timeout: 20_000 })
  await db.from('homework_submissions').update({ status: 'yapilmadi', marked_at: null }).eq('homework_id', hw!.id).eq('student_id', A)
  await page.reload()
  await expect(satir).toBeVisible({ timeout: 20_000 })
  await expect(satir.getByText('✓ yapıldı (öğretmen işaretledi)')).toHaveCount(0)

  // Sil → kayıtta gizli; yenileyince plana dönmez, "Plana girmeyen ödevler"de
  page.once('dialog', d => d.accept())
  await satir.getByRole('button', { name: /görevini sil/ }).click()
  await kaydedildi(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Haftalık Takip' })).toBeVisible({ timeout: 20_000 })
  await expect(satir).toHaveCount(0)
  const liste = page.getByRole('region', { name: 'Plana girmeyen ödevler' })
  await expect(liste.getByText('Kimya — E2E orbital ödevi')).toBeVisible()
  const { data: h } = await db.from('mentor_haftalari').select('icerik').eq('student_id', A).eq('hafta_basi', HAFTA).single()
  expect((h!.icerik as { gizliOdevler?: string[] }).gizliOdevler).toContain(hw!.id)

  // Plana ekle → geri gelir
  await liste.getByRole('button', { name: 'Plana ekle' }).click()
  await kaydedildi(page)
  await expect(satir).toBeVisible()
})
