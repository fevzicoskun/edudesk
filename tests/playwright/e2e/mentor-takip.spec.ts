import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { addDaysISO, todayLocalISO } from '@/src/shared/date'
import { haftaBasi, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { VELI_GERI_BILDIRIM_GOSTER } from '@/app/(dashboard)/mentorluk/[studentId]/takip/SonucKagidi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)
const kullanici = async (email: string) => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const id = data.users.find(u => u.email === email)!.id
  const { data: p } = await db.from('profiles').select('id, school_id, full_name').eq('id', id).single()
  return p!
}
const OGRETMEN = process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'

let ogrId = '', mentor = { id: '', school_id: '', full_name: '' }

/** Veliye giden sonuç kâğıdı (2026-10-22): ekran kartı hep var, geri bildirim imzanın üstünde,
 *  eksik veri uyarısı yalnız ekranda (baskıda yok), tek A4. */
async function sonucKagidiKontrol(page: Page, hafta: string, { uyari }: { uyari: boolean }) {
  await page.emulateMedia({ media: 'screen' })
  await page.goto(`/mentorluk/${ogrId}/takip/sonuc-kagidi?hafta=${hafta}`)
  await expect(page.getByRole('heading', { name: 'Haftalık Sonuç' })).toBeVisible({ timeout: 20_000 })
  const u = page.getByRole('status').filter({ hasText: 'henüz tam girilmemiş olabilir' })
  await expect(u).toHaveCount(uyari ? 1 : 0)
  await expect(page.getByLabel('Özet', { exact: true })).toContainText('Ekran süresi')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  await expect(page).toHaveTitle(`${o!.full_name} - Haftalık Sonuç ${takipHaftaEtiketi(hafta)}`) // PDF dosya adı
  // Adım 6: veli kimi arayacağını bilir; mentör imza satırı veli imzasıyla aynı sırada
  await expect(page.getByText(`Mentör öğretmen: ${mentor.full_name}`, { exact: true })).toBeVisible()
  const imza = page.getByRole('group', { name: 'İmzalar' })
  await expect(imza).toContainText(/Mentör imzası:.*Veli imzası:.*Tarih:/)
  // Adım 7: görev sayısı yalnız Program kartında; bölüm ya bir şey söyler ya hiç basılmaz (boş başlık yok)
  await expect(page.getByText(/\d+ görevden/)).toHaveCount(0)
  const gorevler = page.getByRole('region', { name: 'Görevler' })
  if (await gorevler.count()) await expect(gorevler).toContainText(/Tüm görevler tamamlandı|En çok aksayanlar|programda/)
  const geri = page.getByRole('region', { name: 'Veli geri bildirimi' })
  if (VELI_GERI_BILDIRIM_GOSTER) {
    await expect(geri).toContainText('Bu rapor anlaşılır mıydı?')
    expect((await geri.boundingBox())!.y).toBeLessThan((await page.getByText('Veli imzası:').boundingBox())!.y)
  } else await expect(geri).toHaveCount(0)
  // Koyu temada ekran önizlemesi de beyaz kâğıt: genel .dark .bg-white/.text-gray-* kuralları kâğıdı boyamaz
  const renkler = () => page.locator('article').evaluate(a => {
    const st = (sel: string) => { const e = a.querySelector(sel); return e ? getComputedStyle(e) : null }
    return [getComputedStyle(a.parentElement!).backgroundColor, getComputedStyle(a).color, st('h2')?.color,
      st('[aria-label="Özet"] > div')?.borderColor, st('[aria-label="Özet"] p')?.color]
  })
  const acik = await renkler()
  expect(acik[0]).toBe('rgb(255, 255, 255)')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  expect(await renkler()).toEqual(acik)
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await page.emulateMedia({ media: 'print' })
  await expect(u).toBeHidden()
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await page.pdf({ format: 'A4', preferCSSPageSize: true })) }).promise
  expect(pdf.numPages).toBe(1)
  if (process.env.SONUC_PNG) await page.screenshot({ path: process.env.SONUC_PNG.replace('.png', `-${hafta}.png`), fullPage: true })
  await page.emulateMedia({ media: 'screen' })
}

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
  await expect(page.getByText('Taslak, henüz kaydedilmedi')).toBeVisible()

  await page.getByRole('button', { name: 'Normal' }).click()
  await kaydedildi(page)
  await expect(page.getByText('Taslak, henüz kaydedilmedi')).toHaveCount(0) // ilk değişiklikle kayda döndü
  await page.reload()
  await expect(page.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
  const { data } = await db.from('mentor_haftalari').select('seviye, soru_hedefi').eq('student_id', ogrId).single()
  expect(data).toEqual({ seviye: 1, soru_hedefi: expect.any(Number) })
})

test('kâğıt: öğrenci adı, program, filigran; @page kenarı 0', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('19–25 Ekim', { exact: true })).toBeVisible()
  // Chrome "PDF olarak kaydet" dosya adını sayfa başlığından alır (2026-10-22 kullanıcı isteği)
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  await expect(page).toHaveTitle(`${o!.full_name} - Haftalık Çalışma Planı 19–25 Ekim`)
  // Başlık KÂĞITTA da görünmeli: globals.css baskıda <header>'ları gizliyor (2026-10-16 görsel kontrolde yakalandı)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Pazartesi' })).toBeVisible() // gün kutuları (2026-10-21)
  await expect(page.locator('.filigran img')).toHaveCount(1)
  const kenar = await page.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
    .filter((r): r is CSSPageRule => r instanceof CSSPageRule && !!r.style.margin).map(r => r.style.margin))
  expect(kenar).toEqual(['0px'])
})

// 2026-10-21: ödevler artık plana girer (gün kutuları) → plan kâğıdı en çok 2 A4 (spec), sonuç kâğıdı tek A4
test('kâğıt: 24 görev + 27 tamamlanmamış + 11 bu hafta + 8 gelecek ödevle plan kâğıdı yine tek A4 (aşırı yük küçültülür), sonuç kâğıdı tek A4', async ({ page }) => {
  const { data: o } = await db.from('students').select('class_id').eq('id', ogrId).single()
  const odev = (title: string, due_date: string) => ({ teacher_id: mentor.id, class_id: o!.class_id, school_id: mentor.school_id, subject: 'Fizik', title, due_date, assigned_date: '2026-10-01' })
  const { data: eklenen, error } = await db.from('homeworks').insert([
    // Gerçek okuldaki en ağır öğrenci (2026-10-17 ölçüm): 27 tamamlanmamış + 11 bu hafta + 8 gelecek hafta
    ...Array.from({ length: 11 }, (_, i) => odev(`E2E kâğıt ödevi ${i + 1} biraz uzunca bir başlık`, `2026-10-${19 + (i % 5)}`)),
    ...Array.from({ length: 27 }, (_, i) => odev(`E2E eski ödev ${i + 1} Kondisyon Sy 13-22`, `2026-10-${String(7 + (i % 9)).padStart(2, '0')}`)),
    ...Array.from({ length: 8 }, (_, i) => odev(`E2E gelecek ödev ${i + 1} test kitabı`, `2026-10-${26 + (i % 5)}`)),
  ]).select('id, title')
  if (error) throw new Error(error.message)
  try {
    // Eski üç ödev: öğretmen "yapılmadı" işaretlemiş → Tamamlanmamış bölümünde (işaret satırı ödevle birlikte oluşur)
    const { error: e2 } = await db.from('homework_submissions').update({ status: 'yapilmadi', marked_at: new Date().toISOString() })
      .eq('student_id', ogrId).in('homework_id', eklenen!.filter(h => h.title.startsWith('E2E eski')).map(h => h.id))
    if (e2) throw new Error(e2.message)
    await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
    await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Plana girmeyen ödevler:')).toBeVisible() // sığmayan gecikmişler + gelecek hafta
    await expect(page.locator('[data-olcek]')).toHaveCount(1) // TekSayfa ölçtü
    await page.emulateMedia({ media: 'print' })
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const bayt = await page.pdf({ format: 'A4', preferCSSPageSize: true })
    if (process.env.KAGIT_PDF) (await import('fs')).writeFileSync(process.env.KAGIT_PDF, bayt) // elle görsel kontrol
    if (process.env.KAGIT_PNG) { await page.setViewportSize({ width: 680, height: 1000 }); await page.screenshot({ path: process.env.KAGIT_PNG, fullPage: true }) } // A4 içerik genişliği
    // Sonuç kâğıdı aynı yükle (11 bu hafta + 27 önceki) tek A4: satır sınırları devrede, sonuç girilmemiş hafta
    await sonucKagidiKontrol(page, '2026-10-19', { uyari: true })
    await page.goto(`/mentorluk/${ogrId}/takip/sonuc-kagidi?hafta=2026-10-19`)
    await expect(page.getByRole('region', { name: 'Haftanın özeti' })).toContainText('Bu hafta için henüz sonuç girilmedi.')
    await expect(page.getByRole('table', { name: 'Bu haftanın okul ödevleri' }).locator('tbody tr')).toHaveCount(8)
    await expect(page.getByRole('region', { name: 'Okul ödevleri' })).toContainText(/\+ \d+ ödev daha/)
    const onceki = page.getByRole('region', { name: 'Önceki haftalardan kalan ödevler' })
    await expect(onceki.locator('li')).toHaveCount(5)
    await expect(onceki).toContainText('Bu ödevler tamamlanıp ders öğretmenine gösterilebilir.') // adım 8: veliye ne yapılacağı
    await expect(onceki).toContainText(/\+ \d+ ödev daha/)
    await expect(page.getByLabel('Özet', { exact: true })).toContainText('Girilmedi') // ekran süresi henüz yok
    // Hiçbiri öğretmence işaretlenmedi: tabloda "Öğretmen kontrolünde", kartta "0 / n" değil ödev sayısı (2026-10-22 veli gözü)
    await expect(page.getByRole('table', { name: 'Bu haftanın okul ödevleri' })).toContainText('Öğretmen kontrolünde')
    await expect(page.getByRole('table', { name: 'Bu haftanın okul ödevleri' })).not.toContainText('Bekliyor')
    await expect(page.getByLabel('Özet', { exact: true })).toContainText(/Okul ödevleri\s*\d+ ödev\s*Öğretmen kontrolünde/)
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bayt) }).promise
    // Aşırı yükte bile tek A4: TekSayfa baskıda küçültür (2026-10-24 kullanıcı: 2 sayfayı zımbalamak zorunda kaldı)
    expect(pdf.numPages).toBe(1)
  } finally {
    await db.from('homework_submissions').delete().in('homework_id', eklenen!.map(h => h.id))
    await db.from('homeworks').delete().in('id', eklenen!.map(h => h.id))
  }
})

test('plan: her gün görevi tek satır girilir, kâğıtta Pzt–Cum beş güne açılır; konu sütunu yok', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  const program = page.getByRole('region', { name: 'Program' })
  const degerli = (ad: string) => program.getByLabel('Görev', { exact: true }).evaluateAll((els, ad) => els.filter(e => (e as HTMLInputElement).value === ad).length, ad)
  await expect(program.getByLabel('Görev', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  expect(await degerli('Paragraf')).toBe(1) // Pzt–Cum beş kopya tek satır
  await expect(program.getByLabel('Konu', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '+ Her gün görevi ekle' }).click()
  await expect.poll(() => degerli('Yeni görev')).toBe(1)
  await program.locator('input[aria-label="Görev"]').nth((await program.getByLabel('Görev', { exact: true }).evaluateAll(els => els.findIndex(e => (e as HTMLInputElement).value === 'Yeni görev')))).fill('E2E her gün')
  await kaydedildi(page)
  const { data } = await db.from('mentor_haftalari').select('icerik').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single()
  const kopyalar = (data!.icerik as { gorevler: { ad: string; gun: number; grup?: string }[] }).gorevler.filter(g => g.ad === 'E2E her gün')
  expect(kopyalar.map(g => g.gun)).toEqual([0, 1, 2, 3, 4]); expect(new Set(kopyalar.map(g => g.grup)).size).toBe(1)
  await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
  await expect(page.locator('article').getByRole('listitem').filter({ hasText: 'E2E her gün' })).toHaveCount(5) // Pzt–Cum kutuları
})

const KAYNAK = 'Kaynaklar (soru bankası, test)'
const kitapEkle = async (page: Page, ad: string, ders = 'Matematik') => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=dosya`)
  const bolum = page.getByRole('region', { name: KAYNAK })
  await bolum.getByLabel('Kitap adı').fill(ad)
  await bolum.getByLabel('Ders').selectOption(ders) // serbest metin değil, okulun ders listesi
  await bolum.getByRole('button', { name: 'Kitap ekle' }).click()
  await expect(bolum.getByRole('button', { name: `${ad} kitabını sil` })).toBeVisible()
}

test('silinen kaynak, bağlı olduğu görevde adıyla görünmeye devam eder', async ({ page }) => {
  await kitapEkle(page, 'E2E Soru Bankası')
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await expect(page.getByRole('region', { name: 'Mentör ödevleri' })).toHaveCount(0) // boş bölüm kalktı
  const son = () => page.getByRole('region', { name: 'Program' }).getByLabel('Kitap', { exact: true }).last()
  await son().selectOption({ label: 'E2E Soru Bankası · Matematik' })
  await kaydedildi(page)
  page.on('dialog', d => d.accept())
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=dosya`)
  await page.getByRole('region', { name: KAYNAK }).getByRole('button', { name: 'E2E Soru Bankası kitabını sil' }).click()
  await expect(page.getByRole('region', { name: KAYNAK }).getByRole('button', { name: 'E2E Soru Bankası kitabını sil' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Okuma kitapları' })).toBeVisible()
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await expect(son().locator('option:checked')).toHaveText('E2E Soru Bankası')
})

test('göreve kitap + sayfa aralığı bağlanır, kâğıtta görev satırında görünür', async ({ page }) => {
  await kitapEkle(page, 'E2E Acil Mat', 'Matematik')
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await expect(page.getByLabel('Kitap adı')).toHaveCount(0) // kitap formu plan sayfasında değil
  const kitap = page.getByRole('region', { name: 'Program' }).getByLabel('Kitap', { exact: true }).first()
  await kitap.selectOption({ label: 'E2E Acil Mat · Matematik' })
  await page.getByLabel('Başlangıç sayfası').first().fill('45')
  await page.getByLabel('Bitiş sayfası').first().fill('60')
  await kaydedildi(page)
  await page.reload()
  await expect(page.getByLabel('Bitiş sayfası').first()).toHaveValue('60')
  // Her gün görevinde haftalık aralık Pzt–Cum'a bölünür (16 sf → 4,3,3,3,3); planda önizleme
  await expect(page.getByLabel('Günlük sayfa dağılımı').first()).toHaveText('Pzt 45–48 · Sal 49–51 · Çar 52–54 · Per 55–57 · Cum 58–60')
  // Önizleme varken Sil düğmesi görev satırında kalır (alt satıra kaymaz)
  const program = page.getByRole('region', { name: 'Program' })
  const gorevKutusu = (await program.getByLabel('Görev', { exact: true }).nth(1).boundingBox())!
  const silDugmesi = (await program.getByRole('button', { name: 'Matematik soru bankası görevini sil' }).boundingBox())!
  expect(Math.abs((silDugmesi.y + silDugmesi.height / 2) - (gorevKutusu.y + gorevKutusu.height / 2))).toBeLessThan(6)
  await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
  const banka = page.locator('article').getByRole('listitem').filter({ hasText: 'Matematik soru bankası' })
  await expect(banka).toHaveCount(5)
  await expect(banka.nth(0)).toContainText('E2E Acil Mat s. 45–48')
  await expect(banka.nth(4)).toContainText('E2E Acil Mat s. 58–60')
})
test('sonuç: Tümü yapıldı + ders satırında D/Y/B → net, doğruluk; D>Ç girilemez; yenilemede kalır', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`)
  await page.getByRole('button', { name: 'Tümü yapıldı' }).click()
  // Okul ödevi görevleri hariç (salt okunur, dersin öğretmeni işaretler — 2026-10-21)
  await expect(page.getByRole('region', { name: 'Görevler' }).locator('input[aria-label="Yaptı"]:not(:checked):not(:disabled)')).toHaveCount(0)
  // Görev satırlarında soru/doğru kutusu artık yok (2026-10-17)
  await expect(page.getByRole('region', { name: 'Görevler' }).getByLabel('Doğru')).toHaveCount(0)
  const satir = page.getByRole('region', { name: 'Soru sonuçları' }).getByRole('row', { name: 'Matematik', exact: true })
  // İlk değer girilince tablo aşağı kaymamalı ("Ders bazında doğruluk" ve uyarı satırı hep yer tutar)
  await page.waitForLoadState('networkidle')
  const tabloY = async () => (await page.getByRole('region', { name: 'Soru sonuçları' }).boundingBox())!.y
  const ilkY = await tabloY()
  await expect(page.getByLabel('Ders bazında doğruluk')).toContainText('—')
  await satir.getByLabel('Çözülen').fill('40')
  await satir.getByLabel('Doğru').fill('50')
  await expect(satir.getByLabel('Doğru')).toHaveValue('40') // çözülenden büyük girilemez
  expect(await tabloY()).toBe(ilkY)
  await satir.getByLabel('Doğru').fill('30')
  await satir.getByLabel('Yanlış').fill('9')
  await satir.getByLabel('Boş').fill('2')
  await expect(satir.getByRole('alert')).toContainText('41') // D+Y+B > Ç uyarısı
  await satir.getByLabel('Yanlış').fill('8')
  await expect(satir.getByRole('alert')).toHaveCount(0)
  await expect(satir).toContainText('28') // net = 30 − 8/4
  await expect(satir).toContainText('%75')
  // "Kaydedildi" önceki kayıttan kalmış olabilir → son yazımı DB'den bekle
  await expect.poll(async () => ((await db.from('mentor_haftalari').select('icerik').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single())
    .data!.icerik as { sonuclar?: { anahtar: string; yanlis: number | null }[] }).sonuclar?.find(s => s.anahtar === 'd:Matematik')?.yanlis, { timeout: 15_000 }).toBe(8)
  await page.reload()
  const yeni = page.getByRole('region', { name: 'Soru sonuçları' }).getByRole('row', { name: 'Matematik', exact: true })
  await expect(yeni.getByLabel('Yanlış')).toHaveValue('8')
  await expect(page.getByRole('region', { name: 'Özet' }).getByText('Doğruluk', { exact: true }).locator('..')).toContainText('%75')
  await expect(page.getByLabel('Ders bazında doğruluk')).toContainText('Matematik %75')
  const { data } = await db.from('mentor_haftalari').select('soru, dogru, islendi, gorev_yapilan, gorev_toplam, icerik').eq('student_id', ogrId).single()
  expect(data).toMatchObject({ soru: 40, dogru: 30, islendi: true })
  // Tümü yapıldı; okul ödevi görevleri öğretmen işaretine bağlı (2026-10-21)
  const odevAcik = (data!.icerik as { gorevler: { odevId?: string; yapti: boolean }[] }).gorevler.filter(g => g.odevId && !g.yapti).length
  expect(data!.gorev_yapilan).toBe(data!.gorev_toplam - odevAcik)
  // Sonuç kâğıdı: özet cümlesi + durum etiketi; boş satırlar ve Net/Doğruluk kartları yok; hafta kapanmadı → uyarı
  await sonucKagidiKontrol(page, '2026-10-19', { uyari: true })
  await expect(page.getByRole('region', { name: 'Haftanın özeti' })).toContainText(/bu hafta programın %\d+'.+ tamamladı ve 40 soru çözdü \(hedef \d+\), doğruluk %75\./)
  // Program ~%97 ama 40 soru (hedefin altı) → etiket düşüğe göre: "İyi gidiyor" DEĞİL (2026-10-22 veli gözü)
  await expect(page.getByRole('region', { name: 'Haftanın özeti' })).toContainText('▲ Birlikte takip edelim')
  await expect(page.getByRole('table', { name: 'Soru sonuçları' }).locator('tbody tr')).toHaveCount(1) // yalnız çözüleni olan Matematik
  await expect(page.getByLabel('Özet', { exact: true })).not.toContainText('Doğruluk')
})

test('ekran süresi: Sonuç sekmesinde ondalık girilir, kaydedilir; veli mesajı, geçmiş tablosu ve plan kâğıdında', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`)
  await page.waitForLoadState('networkidle')
  const kutu = page.getByLabel('Ekran süresi (günlük ort., saat)')
  // Yeni satır açmaz: ders bazında doğruluk satırıyla aynı hizada
  const satirY = (await page.getByLabel('Ders bazında doğruluk').boundingBox())!
  const kutuY = (await kutu.boundingBox())!
  expect(Math.abs((kutuY.y + kutuY.height / 2) - (satirY.y + satirY.height / 2))).toBeLessThan(12)
  await kutu.fill('2,5')
  await expect.poll(async () => ((await db.from('mentor_haftalari').select('icerik').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single())
    .data!.icerik as { ekranSuresi?: number }).ekranSuresi, { timeout: 15_000 }).toBe(2.5)
  await page.reload()
  await expect(page.getByLabel('Ekran süresi (günlük ort., saat)')).toHaveValue('2,5')
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=veli`)
  await expect(page.getByLabel(/Veliye gidecek mesaj/)).toHaveValue(/• Ekran süresi: günlük ort\. 2,5 saat/)
  await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
  // Ekran süresi artık her gün kutusunda (2026-10-22); veli imzası altındaki haftalık alan kalktı
  await expect(page.locator('article section h2').first()).toContainText('Ekran: ___ sa')
  await expect(page.getByText('Günlük ortalama ekran süresi')).toHaveCount(0)
  await page.goto(`/mentorluk/${ogrId}/takip/sonuc-kagidi?hafta=2026-10-19`)
  await expect(page.getByLabel('Özet', { exact: true })).toContainText('2,5 saat / gün')
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-26&sekme=dosya`)
  await expect(page.getByRole('region', { name: 'Geçmiş haftalar' }).getByRole('row', { name: /19–25 Ekim/ })).toContainText('2,5 sa')
})
test('iki sekme: eski sekme üzerine yazamaz', async ({ page, context }) => {
  const url = `/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`
  const ikinci = await context.newPage()
  await Promise.all([page.goto(url), ikinci.goto(url)])
  await page.getByLabel('Öğretmen notu').fill('Birinci sekme')
  await kaydedildi(page)
  await ikinci.getByLabel('Öğretmen notu').fill('İkinci sekme')
  await expect(ikinci.getByRole('alert').filter({ hasText: 'Başka bir ekranda değişti' })).toBeVisible({ timeout: 15_000 })
  const { data } = await db.from('mentor_haftalari').select('gorusme').eq('student_id', ogrId).single()
  expect((data!.gorusme as { not: string }).not).toBe('Birinci sekme')
})
test('Mentörlüğüm listesinde bu haftanın durumu', async ({ page }) => {
  const bu = haftaBasi(todayLocalISO()) // takip haftası Cuma başlar (2026-10-22)
  await page.goto('/mentorluk')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  const satir = page.locator('table').getByRole('row', { name: new RegExp(o!.full_name) })
  const { data: h } = await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', bu)
  await expect(satir).toContainText(h?.length ? /Kâğıtta|İşlendi/ : /Plan yok/)
  await expect(page.getByRole('link', { name: 'Bu haftanın planları' })).toBeVisible()
})
test('sol menü: Mentörlük altında Haftalık veli bülteni ve öğrenci öğrenci Haftalık planlar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/anasayfa')
  await page.waitForLoadState('networkidle')
  const menu = page.locator('aside')
  await menu.getByRole('button', { name: 'Mentörlük alt menüsünü aç' }).click()
  await menu.getByRole('link', { name: 'Haftalık veli bülteni' }).click()
  await expect(page.getByRole('heading', { name: 'Haftalık veli bülteni' })).toBeVisible({ timeout: 15_000 })
  // /mentorluk altındayken menü açık kalır
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  const plan = menu.getByRole('button', { name: 'Haftalık planlar' })
  if ((await plan.getAttribute('aria-expanded')) !== 'true') await plan.click()
  await menu.getByRole('link', { name: o!.full_name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/mentorluk/${ogrId}/takip[?]sekme=plan$`))
  await expect(page.getByRole('heading', { name: 'Haftalık Takip' })).toBeVisible()
  await expect(menu.getByRole('link', { name: o!.full_name, exact: true })).toHaveAttribute('aria-current', 'page')
  // Haftalık planlar altında ilk satır: bu haftanın tüm plan kâğıtları (2026-10-22 kullanıcı isteği)
  await menu.getByRole('link', { name: 'Hepsini yazdır', exact: true }).click()
  await expect(page).toHaveURL(/\/mentorluk\/takip-kagitlari$/)
  await expect(menu.getByRole('link', { name: 'Hepsini yazdır', exact: true })).toHaveAttribute('aria-current', 'page')
})
test('telefon: Daha Fazla çekmecesinde Mentörlük → Haftalık veli bülteni ve Haftalık planlar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/anasayfa')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Daha fazla' }).click()
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  await page.getByText('Haftalık planlar', { exact: true }).click()
  await page.getByRole('link', { name: o!.full_name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/mentorluk/${ogrId}/takip[?]sekme=plan$`))
  await page.getByRole('button', { name: 'Daha fazla' }).click()
  await page.getByRole('link', { name: 'Haftalık veli bülteni' }).click()
  await expect(page.getByRole('heading', { name: 'Haftalık veli bülteni' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Daha fazla' }).click()
  await page.locator('summary', { hasText: 'Haftalık planlar' }).click() // bülten sayfasında aynı metin içerikte de var
  await page.getByRole('link', { name: 'Hepsini yazdır', exact: true }).click()
  await expect(page).toHaveURL(/\/mentorluk\/takip-kagitlari$/)
})
test('Mentörlüğüm: kitap ekle (tüm mentör öğrencilerime) — olan atlanır', async ({ page }) => {
  await page.goto('/mentorluk')
  await page.getByText('Kitap ekle (tüm mentör öğrencilerime)').click()
  const form = page.getByRole('form', { name: 'Tüm mentör öğrencilerime kitap ekle' })
  await form.getByLabel('Kitap adı').fill('E2E Herkese Kitap')
  await form.getByLabel('Ders').selectOption('Fizik')
  await form.getByRole('button', { name: 'Hepsine ekle' }).click()
  await expect(form.getByRole('status')).toContainText(/\d+ öğrenciye eklendi/, { timeout: 20_000 })
  await form.getByLabel('Kitap adı').fill('E2E Herkese Kitap')
  await form.getByLabel('Ders').selectOption('Fizik')
  await form.getByRole('button', { name: 'Hepsine ekle' }).click()
  await expect(form.getByRole('status')).toContainText(/^0 öğrenciye eklendi; \d+ öğrencide zaten vardı/, { timeout: 20_000 })
  const { data } = await db.from('mentor_kitaplari').select('id').eq('student_id', ogrId).eq('ad', 'E2E Herkese Kitap').is('deleted_at', null)
  expect(data).toHaveLength(1)
  await db.from('mentor_kitaplari').delete().eq('ad', 'E2E Herkese Kitap')
})

test('Mentörlüğüm: Geçen hafta sütunu program % ve doğruluk % (%50 altı kırmızı)', async ({ page }) => {
  const gecen = addDaysISO(haftaBasi(todayLocalISO()), -7) // takip haftası Cuma başlar
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
test('veli mesajı: haftanın verisinden dolar; düzenleme kaydedilir, rapora geçer; Yeniden oluştur', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`)
  await page.getByLabel('Veliden ricam').fill('E2E akşam telefonu alın')
  await expect.poll(async () => ((await db.from('mentor_haftalari').select('gorusme').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single())
    .data!.gorusme as { rica?: string }).rica, { timeout: 15_000 }).toBe('E2E akşam telefonu alın')
  // Sonuç kâğıdı: kayıtlı rica "Evde sizden ricamız:" satırında, boş çizgi yerine (2026-10-22 veli gözü)
  await page.goto(`/mentorluk/${ogrId}/takip/sonuc-kagidi?hafta=2026-10-19`)
  const rica = page.getByRole('region', { name: 'Öğretmen notu' }).getByLabel('Evde sizden ricamız')
  await expect(rica).toHaveText('Evde sizden ricamız: E2E akşam telefonu alın', { timeout: 20_000 })
  await expect(page.getByText('Sizden ricam:')).toHaveCount(0) // eski ayrı paragraf yok, metin tek yerde
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=veli`)
  const mesaj = page.getByLabel(/Veliye gidecek mesaj/)
  await expect(mesaj).toHaveValue(/Sayın Veli, .+ için 19–25 Ekim haftasının özeti/)
  await expect(mesaj).toHaveValue(/• Soru: 40 soru, doğruluk %75/)
  await expect(mesaj).toHaveValue(/• Ders bazında: Matematik %75/)
  await expect(mesaj).toHaveValue(/• Sizden ricam: E2E akşam telefonu alın/)
  await expect(page.getByRole('link', { name: "WhatsApp'ta gönder" })).toHaveAttribute('href', /wa\.me/)
  await page.waitForLoadState('networkidle') // hydration bitmeden yazılan metin otomatik mesajın başına eklenir
  await mesaj.fill('E2E elle yazılmış veli mesajı')
  await expect(mesaj).toHaveValue('E2E elle yazılmış veli mesajı')
  // Sekme değişince "Kaydedildi" yazısı öncekinden kalır → kaydı DB'den bekle
  await expect.poll(async () => ((await db.from('mentor_haftalari').select('gorusme').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single())
    .data!.gorusme as { veliMesaji: string | null }).veliMesaji, { timeout: 15_000 }).toBe('E2E elle yazılmış veli mesajı')
  await page.reload()
  await expect(page.getByLabel(/Veliye gidecek mesaj/)).toHaveValue('E2E elle yazılmış veli mesajı')
  await page.goto(`/mentorluk/${ogrId}/takip/veli-raporu?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Mentörlük Raporu' })).toBeVisible()
  await expect(page.getByText('E2E elle yazılmış veli mesajı')).toBeVisible()
  await expect(page.locator('.filigran img')).toHaveCount(1)
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=veli`)
  page.on('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Yeniden oluştur' }).click()
  await expect(page.getByLabel(/Veliye gidecek mesaj/)).toHaveValue(/Sayın Veli/)
  await expect.poll(async () => ((await db.from('mentor_haftalari').select('gorusme').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single())
    .data!.gorusme as { veliMesaji: string | null }).veliMesaji, { timeout: 15_000 }).toBeNull()
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
  const harita = page.getByRole('region', { name: 'Konu haritası' }) // Kitaplar bölümünde de "Ders" var
  await harita.getByLabel('Ders').fill('Fizik'); await harita.getByLabel('Konu', { exact: true }).fill('E2Ekonu Vektörler')
  await page.getByRole('button', { name: 'Konu ekle' }).click()
  await expect(page.getByRole('button', { name: 'E2Ekonu Vektörler: Başlanmadı' })).toBeVisible({ timeout: 15_000 })
})
test('toplu kâğıt: planı olan öğrenci ayrı sayfada', async ({ page }) => {
  await page.goto('/mentorluk/takip-kagitlari?hafta=2026-10-19')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  await expect(page.getByRole('region', { name: o!.full_name })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('section.break-after-page')).not.toHaveCount(0)
  await expect(page).toHaveTitle('Haftalık Çalışma Planları 19–25 Ekim') // PDF dosya adı
})

test('toplu kâğıt: bu haftaya dokunulmamış ama planı geçen haftadan devam eden öğrenci de çıkar', async ({ page }) => {
  await page.goto('/mentorluk/takip-kagitlari?hafta=2026-10-26')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  await expect(page.getByRole('region', { name: o!.full_name })).toBeVisible({ timeout: 20_000 })
  expect((await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', '2026-10-26')).data).toHaveLength(0)
})

test('yazdır: son yazılan görev adı hemen basılan kâğıda girer (kayıt/okuma yarışı yok)', async ({ page, context }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await page.getByRole('region', { name: 'Program' }).getByLabel('Görev', { exact: true }).last().fill('E2E yarış görevi')
  const [kagit] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Kâğıdı yazdır' }).click()])
  await expect(kagit.locator('article')).toContainText('E2E yarış görevi', { timeout: 20_000 })
  await kagit.close()
})

test('kayıt hatasının nedeni ekranda görünür (boş görev adı)', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await page.getByLabel('Görev').first().fill('')
  await expect(page.getByRole('alert').filter({ hasText: 'Görev adı boş olamaz' })).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('Miktar').first().click() // alandan çık → ad "Görev" olarak geri dolar, kayıt düzelir
  await expect(page.getByRole('status').filter({ hasText: 'Kaydedildi' })).toBeVisible({ timeout: 15_000 })
})

test("kaldığı sayfa: sonuçta 55 → kâğıtta/veli mesajında geride; sonraki hafta 56'dan aynı uzunlukta (56–71)", async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`)
  const kitapSatiri = page.getByRole('region', { name: 'Soru sonuçları' }).getByRole('row', { name: 'E2E Acil Mat' })
  await expect(kitapSatiri.getByLabel('Kaldığı sayfa')).toHaveValue('60') // varsayılan: planın sonu
  await page.waitForLoadState('networkidle')
  await kitapSatiri.getByLabel('Kaldığı sayfa').fill('55')
  await expect.poll(async () => ((await db.from('mentor_haftalari').select('icerik').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single())
    .data!.icerik as { sonuclar?: { anahtar: string; kaldigi?: number }[] }).sonuclar?.find(s => s.anahtar.startsWith('k:'))?.kaldigi, { timeout: 15_000 }).toBe(55)
  await page.goto(`/mentorluk/${ogrId}/takip/sonuc-kagidi?hafta=2026-10-19`)
  // Çözüleni girilmemiş kitap satırı veliye giden kâğıtta gizli (2026-10-22); kaldığı sayfa veli mesajında
  await expect(page.getByRole('table', { name: 'Soru sonuçları' })).not.toContainText('E2E Acil Mat', { timeout: 20_000 })
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=veli`)
  await expect(page.getByLabel(/Veliye gidecek mesaj/)).toHaveValue(/• Kaynaklar: E2E Acil Mat planlanan s\. 60, kaldığı s\. 55/)
})

test('geçen haftayı kopyala: plan gelir, kitap kaldığı sayfadan aynı uzunlukta (kaldığı 55 → 56–71)', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-26`)
  await expect(page.getByRole('heading', { name: 'Haftalık Takip' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Geçen haftayı kopyala' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'planı kopyalandı' })).toBeVisible({ timeout: 15_000 })
  await kaydedildi(page)
  await expect(page.getByLabel('Başlangıç sayfası').first()).toHaveValue('56')
  await expect(page.getByLabel('Bitiş sayfası').first()).toHaveValue('71')
  const { data } = await db.from('mentor_haftalari').select('icerik').eq('student_id', ogrId).eq('hafta_basi', '2026-10-26').single()
  const bagli = (data!.icerik as { gorevler: { kitapAdi?: string; sayfaBas?: number }[] }).gorevler.find(g => g.kitapAdi === 'E2E Acil Mat')
  expect(bagli?.sayfaBas).toBe(56)
  // 19 Ekim haftasının kendisine dokunulmadı
  const { data: eski } = await db.from('mentor_haftalari').select('icerik').eq('student_id', ogrId).eq('hafta_basi', '2026-10-19').single()
  expect((eski!.icerik as { gorevler: { kitapAdi?: string; sayfaBas?: number }[] }).gorevler.find(g => g.kitapAdi === 'E2E Acil Mat')?.sayfaBas).toBe(45)
})

test('bu planı tüm mentör öğrencilerime uygula: planı olmayan öğrenciye kitabıyla kopyalanır', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Bu planı tüm mentör öğrencilerime uygula' }).click()
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

test('taslak hafta: etiket görünür; Kâğıdı yazdır taslağı kayda dönüştürür ve etiket kalkar', async ({ page, context }) => {
  const HAFTA = '2026-11-09'
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=${HAFTA}`)
  await expect(page.getByText('Taslak, henüz kaydedilmedi')).toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  expect((await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', HAFTA)).data).toHaveLength(0)
  const [kagit] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Kâğıdı yazdır' }).click()])
  await expect(kagit.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible({ timeout: 20_000 })
  await kagit.close()
  await expect(page.getByText('Taslak, henüz kaydedilmedi')).toHaveCount(0)
  expect((await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', HAFTA)).data).toHaveLength(1)
})

test('sonuç kâğıdı: hiç dokunulmamış hafta — "henüz sonuç girilmedi", ekran Girilmedi, uyarı ekranda, tek A4', async ({ page }) => {
  await sonucKagidiKontrol(page, '2026-11-16', { uyari: true })
  await expect(page.getByRole('region', { name: 'Haftanın özeti' })).toHaveText('Bu hafta için henüz sonuç girilmedi.')
  // Girilmemiş veri 0 gibi basılmaz: Program ve Soru kartı "Girilmedi" (hedef korunur)
  const kartlar = page.getByLabel('Özet', { exact: true })
  await expect(kartlar).toContainText(/Program\s*Girilmedi/)
  await expect(kartlar).toContainText(/Soru\s*Girilmedi\s*hedef \d+/)
  await expect(kartlar).not.toContainText(/0 \//)
  await expect(page.getByRole('region', { name: 'Soru sonuçları' })).toContainText('Bu hafta soru sonucu girilmedi.')
  // Rica girilmemiş: veliye dönük satır yine var, elle yazmak için çizgiyle
  const rica = page.getByRole('region', { name: 'Öğretmen notu' }).getByLabel('Evde sizden ricamız')
  await expect(rica).toHaveText('Evde sizden ricamız:')
  await expect(rica.locator('[data-cizgi]')).toHaveCount(1)
  expect((await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', '2026-11-16')).data).toHaveLength(0)
})

test('sonuç kâğıdı: geçen haftayla kıyas yalnız ARDIŞIK haftada ve yalnız iyileşmede (2026-10-22 karar a)', async ({ page }) => {
  const hafta = (hafta_basi: string, soru: number) => ({
    school_id: mentor.school_id, student_id: ogrId, hafta_basi, seviye: 1, soru_hedefi: 120, updated_by: mentor.id,
    icerik: { duzen: '', gorevler: [], mentorOdevleri: [], okuma: null, surum: 2,
      sonuclar: [{ anahtar: 'd:Matematik', ad: 'Matematik', ders: 'Matematik', sayfa: '', cozulen: soru, dogru: soru, yanlis: 0, bos: 0 }] },
    gorusme: { not: '', rica: '', veliMesaji: null }, gorev_toplam: 0, gorev_yapilan: 0, soru, dogru: soru, okuma_sayfa: 0, islendi: true,
  })
  // 23 Kas 20 → 30 Kas 50 (ardışık artış) · 14 Ara 80 (artış VAR ama 7 Ara boş: ardışık değil) · 21 Ara 10 (gerileme)
  const haftalar = [hafta('2026-11-23', 20), hafta('2026-11-30', 50), hafta('2026-12-14', 80), hafta('2026-12-21', 10)]
  const { error } = await db.from('mentor_haftalari').insert(haftalar)
  if (error) throw new Error(error.message)
  try {
    const ozet = async (h: string) => {
      await page.goto(`/mentorluk/${ogrId}/takip/sonuc-kagidi?hafta=${h}`)
      const r = page.getByRole('region', { name: 'Haftanın özeti' })
      await expect(r).toContainText('soru çözdü', { timeout: 20_000 })
      return r
    }
    await expect(await ozet('2026-11-30')).toContainText('Geçen haftaya göre 30 soru daha fazla çözdü.')
    await expect(await ozet('2026-12-14')).not.toContainText('Geçen haftaya göre')
    await expect(await ozet('2026-12-21')).not.toContainText('Geçen haftaya göre')
  } finally {
    await db.from('mentor_haftalari').delete().eq('student_id', ogrId).in('hafta_basi', haftalar.map(h => h.hafta_basi))
  }
})

test('sonuç kâğıdı: görevler işaretli, soru girilmemiş hafta — "0 soru" yazmaz, etiket yalnız programa bakar', async ({ page }) => {
  const gorev = (gun: number, yapti: boolean) => ({ id: `e2e-g${gun}`, gun, ad: 'Kitap okuma', ders: null, miktar: 20, birim: 'dk', soruSatiri: false,
    konu: '', sayfa: '', yapti, soru: null, dogru: null })
  const { error } = await db.from('mentor_haftalari').insert({
    school_id: mentor.school_id, student_id: ogrId, hafta_basi: '2027-01-04', seviye: 1, soru_hedefi: 120, updated_by: mentor.id,
    icerik: { duzen: '', gorevler: [0, 1, 2, 3, 4].map(g => gorev(g, g < 4)), mentorOdevleri: [], okuma: null, surum: 2, sonuclar: [] },
    gorusme: { not: '', rica: '', veliMesaji: null }, gorev_toplam: 5, gorev_yapilan: 4, soru: 0, dogru: 0, okuma_sayfa: 0, islendi: true,
  })
  if (error) throw new Error(error.message)
  try {
    await page.goto(`/mentorluk/${ogrId}/takip/sonuc-kagidi?hafta=2027-01-04`)
    const ozet = page.getByRole('region', { name: 'Haftanın özeti' })
    await expect(ozet).toContainText("programın %80'ini tamamladı.", { timeout: 20_000 })
    await expect(ozet).not.toContainText('soru çözdü')
    await expect(ozet).toContainText('✔ İyi gidiyor') // %80 program; girilmemiş soru %0 sayılmaz
    await expect(page.getByLabel('Özet', { exact: true })).toContainText('4 / 5 görev')
    await expect(page.getByLabel('Özet', { exact: true })).toContainText(/Soru\s*Girilmedi\s*hedef 120/)
    const gorevler = page.getByRole('region', { name: 'Görevler' })
    await expect(gorevler).toContainText(/En çok aksayanlar\s*Kitap okuma — 5 günün 4'ünde yapıldı/)
    await expect(gorevler).not.toContainText('görevden')
  } finally {
    await db.from('mentor_haftalari').delete().eq('student_id', ogrId).eq('hafta_basi', '2027-01-04')
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
    await expect(page.getByLabel('Öğretmen notu')).toBeDisabled()
    await expect(page.getByLabel('Ekran süresi (günlük ort., saat)')).toBeDisabled()
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
    await expect(page.getByRole('table', { name: 'Bu haftanın okul ödevleri' })).toContainText('✔ Yapıldı')
    await expect(page.getByLabel('Özet', { exact: true })).toContainText('1 / 1 yapıldı')
    await expect(page.getByLabel('Özet', { exact: true })).not.toContainText('kontrolünde')
    // Kapalı hafta: uyarı yalnız hiçbir görev işaretlenmemişse
    const { data: k } = await db.from('mentor_haftalari').select('gorev_yapilan').eq('student_id', ogrId).eq('hafta_basi', HAFTA).single()
    await sonucKagidiKontrol(page, HAFTA, { uyari: k!.gorev_yapilan === 0 })

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
      // Sol menüde bülten var, Haftalık planlar yok
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.reload()
      await expect(page.locator('aside').getByRole('link', { name: 'Haftalık veli bülteni' })).toBeVisible()
      await expect(page.locator('aside').getByRole('button', { name: 'Haftalık planlar' })).toHaveCount(0)
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
