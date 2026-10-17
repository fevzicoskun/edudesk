import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)
const kullanici = async (email: string) => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const id = data.users.find(u => u.email === email)!.id
  const { data: p } = await db.from('profiles').select('id, school_id').eq('id', id).single()
  return p!
}
const OGRETMEN = process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'

let ogrId = '', mentor = { id: '', school_id: '' }

test.describe.configure({ mode: 'serial' })
test.use({ storageState: AUTH('ogretmen') })

test.beforeAll(async () => {
  mentor = await kullanici(OGRETMEN)
  // Mentörü olmayan bir öğrenci seç, mentörlüğe ekle, bayrağı aç
  const { data: alinan } = await db.from('mentorships').select('student_id').eq('school_id', mentor.school_id)
  const dolu = new Set((alinan ?? []).map(r => r.student_id))
  const { data: ogr } = await db.from('students').select('id').eq('school_id', mentor.school_id).is('deleted_at', null).limit(200)
  ogrId = ogr!.find(o => !dolu.has(o.id))!.id
  await db.from('mentorships').insert({ school_id: mentor.school_id, mentor_id: mentor.id, student_id: ogrId, assigned_by: mentor.id })
  await db.from('mentor_takip_kullanicilari').upsert({ user_id: mentor.id, school_id: mentor.school_id })
})

test.afterAll(async () => {
  await db.from('mentor_haftalari').delete().eq('student_id', ogrId)
  await db.from('mentor_kitaplari').delete().eq('student_id', ogrId)
  await db.from('ogrenci_konu_durumu').delete().eq('student_id', ogrId)
  await db.from('mentorships').delete().eq('student_id', ogrId).eq('mentor_id', mentor.id)
  await db.from('mentor_takip_kullanicilari').delete().eq('user_id', mentor.id)
  await db.from('konu_listesi').delete().like('ad', 'E2Ekonu%')
})

/** /mentorluk/loading.tsx akışı yüzünden HTTP 200 döner; notFound() içeriği belirler → içeriğe bak. */
const bulunamadi = async (page: Page, url: string) => {
  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: /Haftalık (Takip|Çalışma Planı|Mentörlük Raporu|Sonuç)/ })).toHaveCount(0)
}
const kaydedildi = (page: Page) => expect(page.getByRole('status').filter({ hasText: 'Kaydedildi' })).toBeVisible({ timeout: 15_000 })

test('yalnız bakmak satır yaratmaz; düzenleme kaydedilir ve yenilemede kalır', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Takip' })).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1500)
  await expect(page.getByText('19–25 Ekim', { exact: true })).toBeVisible() // Pzt–Paz (plan hafta sonunu kapsar)
  expect((await db.from('mentor_haftalari').select('id').eq('student_id', ogrId)).data).toHaveLength(0)

  await page.getByRole('button', { name: 'Normal' }).click()
  await kaydedildi(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
  const { data } = await db.from('mentor_haftalari').select('seviye, soru_hedefi').eq('student_id', ogrId).single()
  expect(data).toEqual({ seviye: 1, soru_hedefi: expect.any(Number) })
})

test('kâğıt: öğrenci adı, program, filigran; @page kenarı 0', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('19–25 Ekim', { exact: true })).toBeVisible()
  // Başlık KÂĞITTA da görünmeli: globals.css baskıda <header>'ları gizliyor (2026-10-16 görsel kontrolde yakalandı)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Program' })).toBeVisible()
  await expect(page.locator('.filigran img')).toHaveCount(1)
  const kenar = await page.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
    .filter((r): r is CSSPageRule => r instanceof CSSPageRule && !!r.style.margin).map(r => r.style.margin))
  expect(kenar).toEqual(['0px'])
})

test('kâğıt: 24 görev + 12 bu hafta + 3 tamamlanmamış + 4 gelecek hafta ödeviyle tek A4 sayfa', async ({ page }) => {
  const { data: o } = await db.from('students').select('class_id').eq('id', ogrId).single()
  const odev = (title: string, due_date: string) => ({ teacher_id: mentor.id, class_id: o!.class_id, school_id: mentor.school_id, subject: 'Fizik', title, due_date, assigned_date: '2026-10-06' })
  const { data: eklenen, error } = await db.from('homeworks').insert([
    ...Array.from({ length: 12 }, (_, i) => odev(`E2E kâğıt ödevi ${i + 1} biraz uzunca bir başlık`, `2026-10-${19 + (i % 5)}`)),
    ...Array.from({ length: 3 }, (_, i) => odev(`E2E eski ödev ${i + 1}`, `2026-10-${13 + i}`)),
    ...Array.from({ length: 4 }, (_, i) => odev(`E2E gelecek ödev ${i + 1}`, `2026-10-${27 + i}`)),
  ]).select('id, title')
  if (error) throw new Error(error.message)
  try {
    // Eski üç ödev: öğretmen "yapılmadı" işaretlemiş → Tamamlanmamış bölümünde (işaret satırı ödevle birlikte oluşur)
    const { error: e2 } = await db.from('homework_submissions').update({ status: 'yapilmadi', marked_at: new Date().toISOString() })
      .eq('student_id', ogrId).in('homework_id', eklenen!.filter(h => h.title.startsWith('E2E eski')).map(h => h.id))
    if (e2) throw new Error(e2.message)
    await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
    await expect(page.getByRole('table', { name: 'Bu hafta teslim' }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('table', { name: 'Tamamlanmamış ödevler (teslimi geçti)' }).first()).toContainText('E2E eski ödev')
    await expect(page.getByRole('table', { name: 'Gelecek hafta teslim' }).first()).toContainText('E2E gelecek ödev')
    await page.emulateMedia({ media: 'print' })
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const bayt = await page.pdf({ format: 'A4', preferCSSPageSize: true })
    if (process.env.KAGIT_PDF) (await import('fs')).writeFileSync(process.env.KAGIT_PDF, bayt) // elle görsel kontrol
    if (process.env.KAGIT_PNG) await page.screenshot({ path: process.env.KAGIT_PNG, fullPage: true })
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bayt) }).promise
    expect(pdf.numPages).toBe(1)
  } finally {
    await db.from('homework_submissions').delete().in('homework_id', eklenen!.map(h => h.id))
    await db.from('homeworks').delete().in('id', eklenen!.map(h => h.id))
  }
})

test('silinen kitap eski haftada adıyla görünür', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await page.getByLabel('Kitap adı').fill('E2E Soru Bankası')
  await page.getByRole('button', { name: 'Kitap ekle' }).click()
  await page.getByRole('button', { name: '+ Mentör ödevi ekle' }).click()
  await kaydedildi(page)
  page.on('dialog', d => d.accept())
  await page.getByRole('button', { name: 'E2E Soru Bankası kitabını sil' }).click()
  await page.reload()
  // Görev satırlarında da "Kitap" seçimi var (2026-10-17) → mentör ödevi bölümüne kapsamla
  const mo = page.getByRole('region', { name: 'Mentör ödevleri' }).getByLabel('Kitap', { exact: true })
  await expect(mo).toHaveValue(/.+/)
  await expect(mo.locator('option:checked')).toHaveText('E2E Soru Bankası')
})

test('göreve kitap + sayfa aralığı bağlanır, kâğıtta görev satırında görünür', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await page.getByLabel('Kitap adı').fill('E2E Acil Mat')
  await page.getByLabel('Ders', { exact: true }).fill('Matematik')
  await page.getByRole('button', { name: 'Kitap ekle' }).click()
  await expect(page.getByRole('button', { name: 'E2E Acil Mat kitabını sil' })).toBeVisible()
  const kitap = page.getByRole('region', { name: 'Program' }).getByLabel('Kitap', { exact: true }).first()
  await kitap.selectOption({ label: 'E2E Acil Mat · Matematik' })
  await page.getByLabel('Başlangıç sayfası').first().fill('45')
  await page.getByLabel('Bitiş sayfası').first().fill('60')
  await kaydedildi(page)
  await page.reload()
  await expect(page.getByLabel('Bitiş sayfası').first()).toHaveValue('60')
  await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
  await expect(page.getByRole('table', { name: 'Program' }).getByRole('row').nth(1)).toContainText('E2E Acil Mat s. 45–60')
})
test('sonuç: Tümü yapıldı + ders satırında D/Y/B → net, doğruluk; D>Ç girilemez; yenilemede kalır', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`)
  await page.getByRole('button', { name: 'Tümü yapıldı' }).click()
  await expect(page.getByRole('region', { name: 'Görevler' }).getByRole('checkbox', { name: 'Yaptı', checked: false })).toHaveCount(0)
  // Görev satırlarında soru/doğru kutusu artık yok (2026-10-17)
  await expect(page.getByRole('region', { name: 'Görevler' }).getByLabel('Doğru')).toHaveCount(0)
  const satir = page.getByRole('region', { name: 'Soru sonuçları' }).getByRole('row', { name: 'Matematik', exact: true })
  await satir.getByLabel('Çözülen').fill('40')
  await satir.getByLabel('Doğru').fill('50')
  await expect(satir.getByLabel('Doğru')).toHaveValue('40') // çözülenden büyük girilemez
  await satir.getByLabel('Doğru').fill('30')
  await satir.getByLabel('Yanlış').fill('9')
  await satir.getByLabel('Boş').fill('2')
  await expect(satir.getByRole('alert')).toContainText('41') // D+Y+B > Ç uyarısı
  await satir.getByLabel('Yanlış').fill('8')
  await expect(satir.getByRole('alert')).toHaveCount(0)
  await expect(satir).toContainText('28') // net = 30 − 8/4
  await expect(satir).toContainText('%75')
  await kaydedildi(page)
  await page.reload()
  const yeni = page.getByRole('region', { name: 'Soru sonuçları' }).getByRole('row', { name: 'Matematik', exact: true })
  await expect(yeni.getByLabel('Yanlış')).toHaveValue('8')
  await expect(page.getByRole('region', { name: 'Özet' }).getByText('Doğruluk', { exact: true }).locator('..')).toContainText('%75')
  await expect(page.getByLabel('Ders bazında doğruluk')).toContainText('Matematik %75')
  const { data } = await db.from('mentor_haftalari').select('soru, dogru, islendi, gorev_yapilan, gorev_toplam').eq('student_id', ogrId).single()
  expect(data).toMatchObject({ soru: 40, dogru: 30, islendi: true })
  expect(data!.gorev_yapilan).toBe(data!.gorev_toplam - 1) // mentör ödevi (önceki test) hariç tüm görevler
})

test('iki sekme: eski sekme üzerine yazamaz', async ({ page, context }) => {
  const url = `/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`
  const ikinci = await context.newPage()
  await Promise.all([page.goto(url), ikinci.goto(url)])
  await page.getByLabel('İyi giden').fill('Birinci sekme')
  await kaydedildi(page)
  await ikinci.getByLabel('İyi giden').fill('İkinci sekme')
  await expect(ikinci.getByRole('alert').filter({ hasText: 'Başka bir ekranda değişti' })).toBeVisible({ timeout: 15_000 })
  const { data } = await db.from('mentor_haftalari').select('gorusme').eq('student_id', ogrId).single()
  expect((data!.gorusme as { iyi: string }).iyi).toBe('Birinci sekme')
})
test('Mentörlüğüm listesinde bu haftanın durumu', async ({ page }) => {
  const bu = (() => { const d = new Date(); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) })()
  await page.goto('/mentorluk')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  const satir = page.locator('table').getByRole('row', { name: new RegExp(o!.full_name) })
  const { data: h } = await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', bu)
  await expect(satir).toContainText(h?.length ? /Kâğıtta|İşlendi/ : /Plan yok/)
  await expect(page.getByRole('link', { name: 'Bu haftanın planları' })).toBeVisible()
})
test('Mentörlüğüm: Geçen hafta sütunu program % ve doğruluk % (%50 altı kırmızı)', async ({ page }) => {
  const bu = (() => { const d = new Date(); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) })()
  const gecen = new Date(Date.parse(bu + 'T00:00:00Z') - 7 * 864e5).toISOString().slice(0, 10)
  const { data: var_ } = await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', gecen)
  expect(var_).toHaveLength(0) // test kendi satırını yaratır
  await db.from('mentor_haftalari').insert({
    school_id: mentor.school_id, student_id: ogrId, hafta_basi: gecen, seviye: 1, soru_hedefi: 200,
    icerik: { duzen: '', gorevler: [], mentorOdevleri: [], okuma: null }, gorev_toplam: 24, gorev_yapilan: 18, soru: 40, dogru: 18, islendi: true,
  })
  try {
    await page.goto('/mentorluk')
    const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
    const satir = page.locator('table').getByRole('row', { name: new RegExp(o!.full_name) })
    await expect(satir).toContainText('Program %75 · Doğruluk %45', { timeout: 20_000 })
    await expect(satir.getByText('Doğruluk %45')).toHaveClass(/text-red-700/)
    await expect(satir.getByText('Program %75')).not.toHaveClass(/text-red-700/)
  } finally {
    await db.from('mentor_haftalari').delete().eq('student_id', ogrId).eq('hafta_basi', gecen)
  }
})
test('veli mesajı ve veli raporu', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=veli`)
  await expect(page.getByLabel(/Veliye gidecek mesaj/)).toHaveValue(/Sayın Veli, .+ için 19–23 Ekim haftasının özeti/)
  await expect(page.getByRole('link', { name: "WhatsApp'ta gönder" })).toHaveAttribute('href', /wa\.me/)
  await page.goto(`/mentorluk/${ogrId}/takip/veli-raporu?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Mentörlük Raporu' })).toBeVisible()
  await expect(page.locator('.filigran img')).toHaveCount(1)
})
test('konu haritası: tıkla → durum değişir, yenilemede kalır; konu ekle', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=dosya`)
  const ilk = page.getByRole('region', { name: 'Konu haritası' }).getByRole('button', { name: /: Başlanmadı$/ }).first()
  const ad = (await ilk.getAttribute('aria-label'))!.replace(/: Başlanmadı$/, '')
  await ilk.click()
  await expect(page.getByRole('button', { name: `${ad}: Çalışılıyor` })).toBeVisible()
  // Konu tıklamasında kayıt göstergesi yok: sabit bekleme yerine DB'de satırı bekle (dev'de ilk action derlemesi yavaş)
  await expect.poll(async () => (await db.from('ogrenci_konu_durumu').select('durum').eq('student_id', ogrId)).data?.length, { timeout: 20_000 }).toBe(1)
  await page.reload()
  await expect(page.getByRole('button', { name: `${ad}: Çalışılıyor` })).toBeVisible()
  await page.getByLabel('Ders').fill('Fizik'); await page.getByLabel('Konu', { exact: true }).fill('E2Ekonu Vektörler')
  await page.getByRole('button', { name: 'Konu ekle' }).click()
  await expect(page.getByRole('button', { name: 'E2Ekonu Vektörler: Başlanmadı' })).toBeVisible({ timeout: 15_000 })
})
test('toplu kâğıt: planı olan öğrenci ayrı sayfada', async ({ page }) => {
  await page.goto('/mentorluk/takip-kagitlari?hafta=2026-10-19')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  await expect(page.getByRole('region', { name: o!.full_name })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('section.break-after-page')).not.toHaveCount(0)
})

test('toplu kâğıt: bu haftaya dokunulmamış ama planı geçen haftadan devam eden öğrenci de çıkar', async ({ page }) => {
  await page.goto('/mentorluk/takip-kagitlari?hafta=2026-10-26')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  await expect(page.getByRole('region', { name: o!.full_name })).toBeVisible({ timeout: 20_000 })
  expect((await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', '2026-10-26')).data).toHaveLength(0)
})

test('yazdır: son yazılan konu hemen basılan kâğıda girer (kayıt/okuma yarışı yok)', async ({ page, context }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await page.getByLabel('Konu').first().fill('E2E yarış konusu')
  const [kagit] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Kâğıdı yazdır' }).click()])
  await expect(kagit.getByRole('table', { name: 'Program' })).toContainText('E2E yarış konusu', { timeout: 20_000 })
  await kagit.close()
})

test('kayıt hatasının nedeni ekranda görünür (boş görev adı)', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await page.getByLabel('Görev').first().fill('')
  await expect(page.getByRole('alert').filter({ hasText: 'Görev adı boş olamaz' })).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('Sayfa').first().click() // alandan çık → ad "Görev" olarak geri dolar, kayıt düzelir
  await expect(page.getByRole('status').filter({ hasText: 'Kaydedildi' })).toBeVisible({ timeout: 15_000 })
})

test('geçen haftayı kopyala: plan gelir, kitap sayfası kaldığı yerden (45–60 → 61–76)', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-26`)
  await expect(page.getByRole('heading', { name: 'Haftalık Takip' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Geçen haftayı kopyala' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'planı kopyalandı' })).toBeVisible({ timeout: 15_000 })
  await kaydedildi(page)
  await expect(page.getByLabel('Başlangıç sayfası').first()).toHaveValue('61')
  await expect(page.getByLabel('Bitiş sayfası').first()).toHaveValue('76')
  const { data } = await db.from('mentor_haftalari').select('icerik').eq('student_id', ogrId).eq('hafta_basi', '2026-10-26').single()
  const bagli = (data!.icerik as { gorevler: { kitapAdi?: string; sayfaBas?: number }[] }).gorevler.find(g => g.kitapAdi === 'E2E Acil Mat')
  expect(bagli?.sayfaBas).toBe(61)
  // 19 Ekim haftasının kendisine dokunulmadı
  const { data: eski } = await db.from('mentor_haftalari').select('icerik').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single()
  expect((eski!.icerik as { gorevler: { kitapAdi?: string; sayfaBas?: number }[] }).gorevler.find(g => g.kitapAdi === 'E2E Acil Mat')?.sayfaBas).toBe(45)
})

test('bu planı tüm mentilerime uygula: planı olmayan mentiye kitabıyla kopyalanır', async ({ page }) => {
  const HAFTA = '2026-10-19'
  const { data: alinan } = await db.from('mentorships').select('student_id').eq('school_id', mentor.school_id)
  const dolu = new Set((alinan ?? []).map(r => r.student_id))
  const { data: ogr } = await db.from('students').select('id').eq('school_id', mentor.school_id).is('deleted_at', null).limit(200)
  const ikinci = ogr!.find(o => !dolu.has(o.id))!.id
  await db.from('mentorships').insert({ school_id: mentor.school_id, mentor_id: mentor.id, student_id: ikinci, assigned_by: mentor.id })
  const { data: mentiler } = await db.from('mentorships').select('student_id').eq('mentor_id', mentor.id)
  const { data: once } = await db.from('mentor_haftalari').select('student_id').eq('hafta_basi', HAFTA).in('student_id', mentiler!.map(m => m.student_id))
  const oncedenVar = new Set((once ?? []).map(r => r.student_id))
  try {
    await page.goto(`/mentorluk/${ogrId}/takip?hafta=${HAFTA}`)
    page.on('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Bu planı tüm mentilerime uygula' }).click()
    await expect(page.getByRole('status').filter({ hasText: /\d+ öğrenciye uygulandı/ })).toBeVisible({ timeout: 20_000 })
    const { data: h } = await db.from('mentor_haftalari').select('icerik, islendi').eq('student_id', ikinci).eq('hafta_basi', HAFTA).single()
    expect(h!.islendi).toBe(false)
    const g = (h!.icerik as { gorevler: { kitapId?: string; kitapAdi?: string; sayfaBas?: number }[] }).gorevler.find(x => x.kitapAdi === 'E2E Acil Mat')
    expect(g?.sayfaBas).toBe(45)
    const { data: kitap } = await db.from('mentor_kitaplari').select('id, ders').eq('student_id', ikinci).eq('ad', 'E2E Acil Mat').single()
    expect(kitap).toEqual({ id: g!.kitapId, ders: 'Matematik' })
  } finally {
    const yazilan = mentiler!.map(m => m.student_id).filter(id => id !== ogrId && !oncedenVar.has(id))
    await db.from('mentor_haftalari').delete().eq('hafta_basi', HAFTA).in('student_id', yazilan)
    await db.from('mentor_kitaplari').delete().eq('ad', 'E2E Acil Mat').in('student_id', yazilan)
    await db.from('mentorships').delete().eq('student_id', ikinci).eq('mentor_id', mentor.id)
  }
})

test('haftayı kapat: salt okunur, okul ödevi durumu sabit, DB yazımı reddeder; sonuç kâğıdı tek A4; kilidi aç', async ({ page }) => {
  const HAFTA = '2026-11-02'
  const { data: o } = await db.from('students').select('class_id').eq('id', ogrId).single()
  const { data: hw, error } = await db.from('homeworks').insert({
    teacher_id: mentor.id, class_id: o!.class_id, school_id: mentor.school_id, subject: 'Kimya',
    title: 'E2E kapanış ödevi', due_date: '2026-11-03', assigned_date: '2026-10-20',
  }).select('id').single()
  if (error) throw new Error(error.message)
  const isaretle = (status: string) => db.from('homework_submissions').update({ status, marked_at: new Date().toISOString() })
    .eq('homework_id', hw!.id).eq('student_id', ogrId)
  try {
    await isaretle('yapildi')
    await page.goto(`/mentorluk/${ogrId}/takip?hafta=${HAFTA}&sekme=sonuc`)
    await expect(page.getByRole('region', { name: 'Okul ödevleri' })).toContainText('E2E kapanış ödevi: Yapıldı', { timeout: 20_000 })
    page.on('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Haftayı kapat' }).click()
    await expect(page.getByText(/Bu hafta .* tarihinde kapatıldı/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Tümü yapıldı' })).toBeDisabled()
    await expect(page.getByLabel('İyi giden')).toBeDisabled()
    const { data: r } = await db.from('mentor_haftalari').select('kapali_at, okul_odevleri').eq('student_id', ogrId).eq('hafta_basi', HAFTA).single()
    expect(r!.kapali_at).not.toBeNull()

    // Öğretmen işareti sonradan değişir → kapalı haftada kayıt sabit kalır
    await isaretle('yapilmadi')
    await page.reload()
    await expect(page.getByRole('region', { name: 'Okul ödevleri' })).toContainText('E2E kapanış ödevi: Yapıldı')

    // DB tetikleyicisi: kapalı haftaya doğrudan yazım reddedilir
    const { error: yaz } = await db.from('mentor_haftalari').update({ soru_hedefi: 999 }).eq('student_id', ogrId).eq('hafta_basi', HAFTA)
    expect(yaz?.message).toMatch(/kapalı/)

    // Sonuç kâğıdı: tek A4, özet + öğretmen notu + veli imzası
    await page.goto(`/mentorluk/${ogrId}/takip/sonuc-kagidi?hafta=${HAFTA}`)
    await expect(page.getByRole('heading', { name: 'Haftalık Sonuç' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Öğretmen notu')).toBeVisible()
    await expect(page.getByText('Veli imzası')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Bu haftanın okul ödevleri' })).toContainText('Yapıldı')
    await page.emulateMedia({ media: 'print' })
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await page.pdf({ format: 'A4', preferCSSPageSize: true })) }).promise
    expect(pdf.numPages).toBe(1)
    if (process.env.SONUC_PNG) await page.screenshot({ path: process.env.SONUC_PNG, fullPage: true })
    await page.emulateMedia({ media: 'screen' })

    // Geçmiş haftalarda kilit işareti
    await page.goto(`/mentorluk/${ogrId}/takip?hafta=${HAFTA}&sekme=dosya`)
    await expect(page.getByRole('region', { name: 'Geçmiş haftalar' }).getByLabel('kapalı')).toHaveCount(1, { timeout: 20_000 })

    // Kilidi aç → canlı veri + düzenlenebilir
    await page.goto(`/mentorluk/${ogrId}/takip?hafta=${HAFTA}&sekme=sonuc`)
    await page.getByRole('button', { name: 'Kilidi aç' }).click()
    await expect(page.getByRole('button', { name: 'Tümü yapıldı' })).toBeEnabled({ timeout: 20_000 })
    await expect(page.getByRole('region', { name: 'Okul ödevleri' })).toContainText('E2E kapanış ödevi: Yapılmadı')
  } finally {
    await db.from('mentor_haftalari').update({ kapali_at: null }).eq('student_id', ogrId).eq('hafta_basi', HAFTA)
    await db.from('homework_submissions').delete().eq('homework_id', hw!.id)
    await db.from('homeworks').delete().eq('id', hw!.id)
  }
})

test.describe('idare', () => {
  test.use({ storageState: AUTH('mudur') })
  test('idare özet rakamı görür, görüşme notu görünmez', async ({ page }) => {
    await page.goto('/yonetim/mentorluk')
    const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
    await expect(page.getByRole('listitem').filter({ hasText: o!.full_name })).toContainText(/Program %\d+/)
    await expect(page.getByText('Birinci sekme')).toHaveCount(0)
  })
})
test.describe('erişim', () => {
  test('başka öğretmen (mentörü değil) → 404, kâğıt da 404', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('zumre_baskani') })
    const p = await ctx.newPage()
    for (const yol of ['takip', 'takip/kagit', 'takip/sonuc-kagidi', 'takip/veli-raporu']) await bulunamadi(p, `/mentorluk/${ogrId}/${yol}?hafta=2026-10-19`)
    await ctx.close()
  })

  test('bayrak kapalı → mentör de 404 alır ve bağlantıyı görmez', async ({ page }) => {
    await db.from('mentor_takip_kullanicilari').delete().eq('user_id', mentor.id)
    try {
      await bulunamadi(page, `/mentorluk/${ogrId}/takip`)
      await page.goto(`/mentorluk/${ogrId}`)
      await expect(page.getByRole('link', { name: 'Haftalık takip' })).toHaveCount(0)
      await page.goto('/mentorluk')
      await expect(page.getByRole('link', { name: 'Bu haftanın planları' })).toHaveCount(0)
    } finally {
      await db.from('mentor_takip_kullanicilari').upsert({ user_id: mentor.id, school_id: mentor.school_id })
    }
  })

  test('mentörlük başka öğretmene geçerse eski mentör erişemez', async ({ page }) => {
    const diger = await kullanici(process.env.TEST_EMAIL_ZUMRE_BASKANI ?? 'test_zumre_baskani@test.example')
    await db.from('mentorships').update({ mentor_id: diger.id, assigned_by: diger.id }).eq('student_id', ogrId)
    try {
      await bulunamadi(page, `/mentorluk/${ogrId}/takip`)
    } finally {
      await db.from('mentorships').update({ mentor_id: mentor.id, assigned_by: mentor.id }).eq('student_id', ogrId)
    }
  })
})
