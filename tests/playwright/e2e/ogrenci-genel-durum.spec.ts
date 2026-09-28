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

/** Her durum için bir ödev ekler ve bu öğrenci için o durumla işaretler */
async function odevEkle(durumlar: string[], subject = 'Test') {
  const { data, error } = await db.from('homeworks').insert(durumlar.map((_, i) => ({
    teacher_id: ogretmenId, school_id: schoolId, class_id: classId, subject,
    title: `${ETIKET} ${hwIds.length + i + 1}`, is_template: false,
  }))).select('id')
  if (error) throw error
  const yeni = data!.map(h => h.id as string)
  hwIds.push(...yeni)
  const { error: e2 } = await db.from('homework_submissions')
    .upsert(yeni.map((homework_id, i) => ({ homework_id, student_id: studentId, school_id: schoolId, status: durumlar[i], marked_at: new Date().toISOString() })),
      { onConflict: 'homework_id,student_id' })
  if (e2) throw e2
}

test('az ödevle "Risk" damgası yok; 5 kontrol edilmiş ödevden sonra kural çalışır', async ({ page }) => {
  const perf = page.locator('div', { has: page.getByRole('heading', { name: 'Performans Özeti' }) }).last()

  await odevEkle(['yapilmadi']) // %0 ama 1 ödev
  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}`)
  await expect(perf.getByText('Henüz az ödev', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(perf.getByText('5 ödev kontrol edilince değerlendirilir')).toBeVisible()
  await expect(perf.getByText('Risk', { exact: true })).toHaveCount(0)

  await odevEkle(Array(4).fill('yapilmadi')) // toplam 5, hepsi yapılmadı → %0
  await page.reload()
  await expect(perf.getByText('Risk', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(perf.getByText('Henüz az ödev', { exact: true })).toHaveCount(0)
})

test('ders satırı eksik ve geçi ayrıca gösterir; öğrenci sayfası ile özet birebir aynı metin', async ({ page }) => {
  await odevEkle(['yapildi', 'eksik', 'gec', 'mazeretli'], 'Kimya')
  const beklenen = 'Kimya 1/3 (1 eksik, 1 geç)'

  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}`)
  const satir = page.getByLabel('Derslere göre')
  await expect(satir).toContainText(beklenen, { timeout: 20_000 })
  const sayfaMetni = (await satir.textContent())!.replace('Derslere göre (yapılan / kontrol edilen)', '')

  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}/odev-raporu`)
  const ozet = page.getByText(/^Derslere göre \(yapılan\/kontrol edilen\):/).locator('..')
  await expect(ozet).toContainText(beklenen, { timeout: 20_000 })
  // iki ekranda ders listesi aynı sırada aynı metin
  const norm = (t: string) => t.split('·').map(x => x.trim()).filter(Boolean)
  const ozetMetni = (await ozet.textContent())!.replace('Derslere göre (yapılan/kontrol edilen):', '')
  expect(norm(ozetMetni)).toEqual(norm(sayfaMetni))
})

test('işaretsiz ödev: teslimi gelmemişse "Bekliyor", geçmişse "Kontrol edilmedi" — iki ekranda aynı', async ({ page }) => {
  const gun = (d: number) => new Date(Date.now() + d * 864e5).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
  const { data, error } = await db.from('homeworks').insert([
    { title: `${ETIKET} ileri`, due_date: gun(3), assigned_date: gun(0) },
    { title: `${ETIKET} gecmis`, due_date: gun(-2), assigned_date: gun(-5) },
  ].map(h => ({ ...h, teacher_id: ogretmenId, school_id: schoolId, class_id: classId, subject: 'Biyoloji', is_template: false }))).select('id')
  if (error) throw error
  hwIds.push(...data!.map(h => h.id as string))

  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}`)
  const gecmis = page.locator('section', { has: page.getByRole('heading', { name: 'Ödev Geçmişi' }) })
  // satır kapsayıcısı: kendi ödeviyse <a>, değilse <div> — ikisi de .rounded-lg
  const satir = (ad: string) => gecmis.locator('.rounded-lg', { hasText: `${ETIKET} ${ad}` })
  await expect(satir('ileri')).toContainText('Bekliyor', { timeout: 20_000 })
  await expect(satir('gecmis')).toContainText('Kontrol edilmedi')
  const perf = page.locator('div', { has: page.getByRole('heading', { name: 'Performans Özeti' }) }).last()
  await expect(perf.getByText(/· 1 bekliyor · 1 kontrol edilmedi$/)).toBeVisible()
  // işaretsiz ödev ders satırının paydasına girmez
  await expect(page.getByLabel('Derslere göre')).toContainText('Biyoloji —')

  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}/odev-raporu`)
  const tablo = page.locator('table')
  await expect(tablo.locator('tr', { hasText: `${ETIKET} ileri` })).toContainText('Bekliyor', { timeout: 20_000 })
  await expect(tablo.locator('tr', { hasText: `${ETIKET} gecmis` })).toContainText('Kontrol edilmedi')
  await expect(page.getByText('1 Bekliyor', { exact: true })).toBeVisible()
  await expect(page.getByText('1 Kontrol edilmedi', { exact: true })).toBeVisible()
})

test('ders satırına tıklayınca Ödev Geçmişi o derse süzülür; Tümünü göster, geri tuşu ve bozuk adres', async ({ page }) => {
  await odevEkle(['yapildi'], 'Coğrafya')
  await odevEkle(['eksik'], 'Tarih')
  const sayfa = `/siniflar/${classId}/ogrenciler/${studentId}`
  const gecmis = page.locator('section', { has: page.getByRole('heading', { name: 'Ödev Geçmişi' }) })
  const nav = page.getByRole('navigation', { name: 'Derslere göre' })
  // satırın ders alanı "Tarih · …" — başlıksız ödevde tarih alanı "Tarih yok" yazdığı için ders adına ' · ' ile bağlan
  const satir = (ders: string) => gecmis.locator('.rounded-lg', { hasText: `${ders} · ` })

  await page.goto(sayfa)
  await expect(satir('Tarih')).toBeVisible({ timeout: 20_000 })
  await nav.getByRole('link', { name: 'Coğrafya 1/1' }).click()
  await expect(page).toHaveURL(/[?&]ders=Co%C4%9Frafya/)
  await expect(satir('Tarih')).toHaveCount(0)
  await expect(satir('Coğrafya')).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Coğrafya 1/1' })).toHaveAttribute('aria-current', 'true')
  // diğer dersler satırda kalır — başka derse doğrudan geçilebilir
  await expect(nav.getByRole('link', { name: 'Tarih 0/1 (1 eksik)' })).toBeVisible()

  await gecmis.getByRole('link', { name: 'Tümünü göster' }).click()
  await expect(page).toHaveURL(new RegExp(`${sayfa}$`))
  await expect(satir('Tarih')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/[?&]ders=Co%C4%9Frafya/)
  await expect(satir('Tarih')).toHaveCount(0)

  // bozuk adres: eşleşmeyen ders → tüm liste, "Tümünü göster" yok
  await page.goto(`${sayfa}?ders=Yok`)
  await expect(satir('Tarih')).toBeVisible({ timeout: 20_000 })
  await expect(satir('Coğrafya')).toBeVisible()
  await expect(gecmis.getByRole('link', { name: 'Tümünü göster' })).toHaveCount(0)
})

test('telefonda uzun ders satırı alt satıra geçer, taşmaz (390px)', async ({ page }) => {
  await odevEkle(['yapildi'], 'Edebiyat')
  await odevEkle(['eksik'], 'Fizik')
  await odevEkle(['gec'], 'Matematik')
  await odevEkle(['yapildi'], 'Kimya')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}`)
  const nav = page.getByRole('navigation', { name: 'Derslere göre' })
  await expect(nav.getByRole('link', { name: /^Matematik / })).toBeVisible({ timeout: 20_000 })
  // hiçbir ders bağlantısı satırın sağ kenarını aşmamalı
  const { tasma } = await nav.evaluate(el => {
    const sag = el.getBoundingClientRect().right
    const enSag = Math.max(...[...el.querySelectorAll('a')].map(a => a.getBoundingClientRect().right))
    return { tasma: enSag - sag }
  })
  expect(tasma).toBeLessThanOrEqual(1)
})
