/** Veli toplantısı kâğıdı (spec 2026-10-22): Stoys deneme yükleme + kâğıt. Mentör takip kapısının arkasında. */
import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import os from 'os'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)
const OGRETMEN = process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'
// Gerçek sınavlarla çakışmasın: geçmiş, kimsenin kullanmayacağı tarihler (afterAll siler)
const TARIHLER = ['2026-09-07', '2026-09-08', '2026-09-09']

let mentor = { id: '', school_id: '', full_name: '' }
let ogr = { id: '', full_name: '', class_id: '', sinif: '' }

const blok = (kod: string) => ['SS', 'D', 'Y', 'N', 'YB'].map(s => `${kod}-${s}`)
/** Stoys biçiminde geçici TCD dosyası: [ad, toplam net] satırları; ders netleri toplamla tutarlı değil (test yalnız toplamı okur). */
async function stoysDosyasi(satirlar: [string, number][], sinif: string, { bozuk = false } = {}): Promise<string> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Rapor')
  if (bozuk) {
    ws.addRow(['S.No', 'Öğrenci No', 'Adı Soyadı'])
    ws.addRow([1, 5, 'Ali Veli'])
  } else {
    ws.addRow([' Stoys Rapor '])
    ws.addRow(['OKUL', 'SINIF', 'Öğrenci No', 'Adı Soyadı', ...['TAR', 'COĞ', 'DİN', 'TOP'].flatMap(blok), 'AGIS-Puan', 'AGIS-Sınıf', 'AGIS-Okul', 'AGIS-Genel'])
    for (const [ad, net] of satirlar) ws.addRow(['BKD', sinif, '1', ad, 26, 21, 5, 19.75, 75.96, 26, 24, 0, 24, 92.31, 8, 8, 0, 8, 100, 60, 53, 5, net, 86.25, 448.3])
  }
  const f = path.join(os.tmpdir(), `stoys-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`)
  await wb.xlsx.writeFile(f)
  return f
}

const bulunamadi = async (page: Page, url: string) => {
  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible({ timeout: 20_000 })
}

/** Yükle → önizle → (varsa yeni sınav seç) → kaydet. */
async function yukle(page: Page, dosya: string, tarih: string) {
  await page.goto('/mentorluk/denemeler')
  await page.getByLabel('Stoys Excel dosyası').setInputFiles(dosya)
  await page.getByLabel('Sınav tarihi').fill(tarih)
  await page.getByRole('button', { name: 'Önizle' }).click()
  await expect(page.getByRole('region', { name: 'Önizleme' })).toBeVisible({ timeout: 20_000 })
  const yeni = page.getByRole('radio', { name: /Yeni sınav/ })
  if (await yeni.count()) await yeni.check()
}

const sinavIdleri = async () => (await db.from('deneme_sinavlari').select('id').eq('school_id', mentor.school_id).in('tarih', TARIHLER)).data!.map(s => s.id)

test.describe.configure({ mode: 'serial' })
test.use({ storageState: AUTH('ogretmen') })

test.beforeAll(async () => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const uid = data.users.find(u => u.email === OGRETMEN)!.id
  mentor = (await db.from('profiles').select('id, school_id, full_name').eq('id', uid).single()).data!
  const { data: alinan } = await db.from('mentorships').select('student_id').eq('school_id', mentor.school_id)
  const dolu = new Set((alinan ?? []).map(r => r.student_id))
  const { data: adaylar } = await db.from('students').select('id, full_name, class_id, classes(name)').eq('school_id', mentor.school_id).is('deleted_at', null).limit(200)
  const o = adaylar!.find(x => !dolu.has(x.id) && /\d/.test((x.classes as unknown as { name: string } | null)?.name ?? ''))!
  ogr = { id: o.id, full_name: o.full_name, class_id: o.class_id, sinif: (o.classes as unknown as { name: string }).name }
  await db.from('mentorships').insert({ school_id: mentor.school_id, mentor_id: mentor.id, student_id: ogr.id, assigned_by: mentor.id })
  await db.from('mentor_takip_kullanicilari').upsert({ user_id: mentor.id, school_id: mentor.school_id })
})

test.afterAll(async () => {
  await db.from('deneme_sinavlari').delete().eq('school_id', mentor.school_id).in('tarih', TARIHLER) // sonuçlar cascade
  await db.from('mentorships').delete().eq('student_id', ogr.id).eq('mentor_id', mentor.id)
  await db.from('mentor_takip_kullanicilari').delete().eq('user_id', mentor.id)
})

test('kapı kapalıyken /mentorluk/denemeler bulunamadı', async ({ page }) => {
  await db.from('mentor_takip_kullanicilari').delete().eq('user_id', mentor.id)
  try {
    await bulunamadi(page, '/mentorluk/denemeler')
  } finally {
    await db.from('mentor_takip_kullanicilari').upsert({ user_id: mentor.id, school_id: mentor.school_id })
  }
})

test('yükle → önizleme → kaydet: yalnız mentörün öğrencisi yazılır', async ({ page }) => {
  const f = await stoysDosyasi([[ogr.full_name.toLocaleUpperCase('tr-TR'), 51.75], ['E2E SAHTE KİŞİ', 12]], ogr.sinif)
  await yukle(page, f, TARIHLER[0])
  const on = page.getByRole('region', { name: 'Önizleme' })
  await expect(on).toContainText(`TCD · ${ogr.sinif}`)
  await expect(on.getByRole('row').filter({ hasText: ogr.full_name })).toContainText('51,75')
  await expect(on).toContainText('1 satır başka öğrencilere ait, alınmadı.')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByRole('status').filter({ hasText: /1 öğrencinin sonucu kaydedildi/ })).toBeVisible({ timeout: 20_000 })
  const ids = await sinavIdleri()
  expect(ids).toHaveLength(1)
  const { data: satir } = await db.from('deneme_sonuclari').select('student_id, toplam_net').eq('sinav_id', ids[0])
  expect(satir).toEqual([{ student_id: ogr.id, toplam_net: 51.75 }]) // sahte ad saklanmadı
  await expect(page.getByRole('region', { name: 'Yüklenen denemeler' })).toContainText('TCD')
})

test('tanınmayan dosya açık hata verir, hiçbir şey yazılmaz', async ({ page }) => {
  const once = (await sinavIdleri()).length
  await page.goto('/mentorluk/denemeler')
  await page.getByLabel('Stoys Excel dosyası').setInputFiles(await stoysDosyasi([], '', { bozuk: true }))
  await page.getByRole('button', { name: 'Önizle' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Stoys AGİS raporuna benzemiyor' })).toBeVisible({ timeout: 20_000 }) // Next'in route announcer'ı da role=alert
  expect(await sinavIdleri()).toHaveLength(once)
})

test('sil iki adımlı: sonuç silinir', async ({ page }) => {
  await page.goto('/mentorluk/denemeler')
  const liste = page.getByRole('region', { name: 'Yüklenen denemeler' })
  await liste.getByRole('button', { name: 'Sil' }).first().click()
  await liste.getByRole('button', { name: 'Emin misin? Sil' }).click()
  await expect.poll(async () => (await db.from('deneme_sonuclari').select('student_id').eq('student_id', ogr.id).in('sinav_id', await sinavIdleri())).data!.length,
    { timeout: 15_000 }).toBe(0)
})

// ── Kâğıt (Task 6) ────────────────────────────────────────────────────────────
const KAGIT = () => `/mentorluk/${ogr.id}/veli-toplantisi`
const odevIds: string[] = []
/** Öğrencinin sınıfına ödev ekler; durum verilirse öğretmen işaretlemiş sayılır (marked_at). */
async function odev(title: string, durum: string | null) {
  const { data, error } = await db.from('homeworks').insert({ teacher_id: mentor.id, class_id: ogr.class_id, school_id: mentor.school_id,
    subject: 'Fizik', title, due_date: '2026-10-01', assigned_date: '2026-09-20' }).select('id').single()
  if (error) throw new Error(error.message)
  odevIds.push(data!.id)
  if (durum) await db.from('homework_submissions').update({ status: durum, marked_at: new Date().toISOString() }).eq('homework_id', data!.id).eq('student_id', ogr.id)
}

test.describe('kâğıt', () => {
  test.beforeAll(async () => {
    // Üç TCD (sınıf yüklendi ×3); öğrenci 1. ve 3.'de var, 2.'de yok → Katılmadı
    await db.from('deneme_sinavlari').upsert(TARIHLER.map(tarih => ({ school_id: mentor.school_id, tur: 'TCD', seviye: 9, tarih })),
      { onConflict: 'school_id,tur,seviye,tarih', ignoreDuplicates: true })
    const { data: s } = await db.from('deneme_sinavlari').select('id, tarih').eq('school_id', mentor.school_id).in('tarih', TARIHLER).order('tarih')
    await db.from('deneme_sinav_siniflari').upsert(s!.map(x => ({ sinav_id: x.id, class_id: ogr.class_id, school_id: mentor.school_id })), { ignoreDuplicates: true })
    const sonuc = (i: number, net: number) => ({ sinav_id: s![i].id, student_id: ogr.id, school_id: mentor.school_id,
      dersler: [{ kod: 'TAR', ss: 26, d: 20, y: 4, n: net - 10 }, { kod: 'COĞ', ss: 26, d: 10, y: 0, n: 10 }], toplam_net: net, puan: null })
    await db.from('deneme_sonuclari').delete().eq('student_id', ogr.id)
    await db.from('deneme_sonuclari').insert([sonuc(0, 30), sonuc(2, 33.5)])
    await odev('E2E veli yapılmadı ödevi', 'yapilmadi')
    await odev('E2E veli işaretsiz ödevi', null)
    // Sonucu girilmemiş hafta (Cuma başı)
    await db.from('mentor_haftalari').insert({ school_id: mentor.school_id, student_id: ogr.id, hafta_basi: '2026-10-02', seviye: 1, soru_hedefi: 120,
      icerik: { duzen: '', gorevler: [], mentorOdevleri: [], okuma: null, surum: 2 }, updated_by: mentor.id })
  })
  test.afterAll(async () => {
    await db.from('mentor_haftalari').delete().eq('student_id', ogr.id)
    if (odevIds.length) {
      await db.from('homework_submissions').delete().in('homework_id', odevIds)
      await db.from('homeworks').delete().in('id', odevIds)
    }
  })

  test('deneme gidişi: katılmadı 0 değil, değişim işaretli; ödev listesi; haftalık girilmedi; başlık', async ({ page }) => {
    await page.goto(KAGIT())
    await expect(page.getByRole('heading', { name: 'Veli Toplantısı' })).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveTitle(`${ogr.full_name} - Veli Toplantısı`)
    const tcd = page.getByRole('table', { name: 'TCD denemeleri' })
    await expect(tcd.getByRole('row')).toHaveCount(4) // başlık + 3 sınav
    await expect(tcd.getByRole('row').nth(2)).toContainText('Katılmadı')
    await expect(tcd.getByRole('row').nth(2)).not.toContainText(',') // hiç net yok: 0,00 basılmaz
    await expect(tcd.getByRole('row').nth(3)).toContainText('+3,50')
    const liste = page.getByRole('table', { name: 'Yapılmayan ve eksik ödevler' })
    await expect(liste).toContainText('E2E veli yapılmadı ödevi')
    await expect(liste).not.toContainText('E2E veli işaretsiz ödevi') // işaretlenmemiş yapılmadı sayılmaz
    await expect(page.getByRole('table', { name: 'Haftalık plan' }).getByRole('row').nth(1)).toContainText('Girilmedi')
    await expect(page.getByText('Mentör imzası')).toBeVisible()
  })

  test('koyu temada kâğıt beyaz kalır', async ({ page }) => {
    await page.goto(KAGIT())
    await expect(page.getByRole('heading', { name: 'Veli Toplantısı' })).toBeVisible({ timeout: 20_000 })
    const renkler = () => page.locator('article').evaluate(a => [getComputedStyle(a.parentElement!).backgroundColor, getComputedStyle(a).color])
    const acik = await renkler()
    expect(acik[0]).toBe('rgb(255, 255, 255)')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    expect(await renkler()).toEqual(acik)
  })

  test('uzun ödev listesi iki sayfaya taşar, satır bölünmez', async ({ page }) => {
    for (let i = 0; i < 40; i++) await odev(`E2E uzun liste ödevi ${i + 1} biraz uzunca bir başlık`, 'yapilmadi')
    await page.goto(KAGIT())
    await expect(page.getByRole('heading', { name: 'Veli Toplantısı' })).toBeVisible({ timeout: 20_000 })
    const satir = page.getByRole('table', { name: 'Yapılmayan ve eksik ödevler' }).getByRole('row').nth(5)
    expect(await satir.evaluate(e => getComputedStyle(e).breakInside)).toBe('avoid')
    await page.emulateMedia({ media: 'print' })
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await page.pdf({ format: 'A4', preferCSSPageSize: true })) }).promise
    expect(pdf.numPages).toBeGreaterThanOrEqual(2)
  })

  test('toplu sayfa: başlık ve öğrenci bölümü', async ({ page }) => {
    await page.goto('/mentorluk/veli-toplantisi')
    await expect(page.getByRole('region', { name: ogr.full_name })).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveTitle('Veli Toplantısı Kâğıtları')
  })

  test('menü: Veli toplantısı bağlantısı', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/anasayfa')
    await page.waitForLoadState('networkidle')
    const menu = page.locator('aside')
    await menu.getByRole('button', { name: 'Mentörlük alt menüsünü aç' }).click()
    await menu.getByRole('link', { name: 'Veli toplantısı', exact: true }).click()
    await expect(page).toHaveURL(/\/mentorluk\/veli-toplantisi$/)
    await expect(menu.getByRole('link', { name: 'Denemeler', exact: true })).toBeVisible()
  })

  test('kapı kapalıyken iki sayfa da bulunamadı; MY kâğıdı göremez', async ({ page, browser }) => {
    await db.from('mentor_takip_kullanicilari').delete().eq('user_id', mentor.id)
    try {
      await bulunamadi(page, KAGIT())
      await bulunamadi(page, '/mentorluk/veli-toplantisi')
    } finally {
      await db.from('mentor_takip_kullanicilari').upsert({ user_id: mentor.id, school_id: mentor.school_id })
    }
    const ctx = await browser.newContext({ storageState: AUTH('mudur_yardimcisi') })
    const p = await ctx.newPage()
    // MY öğretmen rolü değil → kâğıt sayfaları ana sayfaya yönlendirir (diğer kâğıtlarla aynı); kâğıt görünmez
    await p.goto(KAGIT())
    await expect(p).toHaveURL(/\/anasayfa/, { timeout: 20_000 })
    await expect(p.getByRole('heading', { name: 'Veli Toplantısı' })).toHaveCount(0)
    await ctx.close()
  })
})
