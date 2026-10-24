/** Bireysel ödev (spec 2026-10-24): öğrenci sayfasından ver, tek tık yapıldı, Verdiğim Bireysel Ödevler listesi. */
import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { addDaysISO, todayLocalISO } from '@/src/shared/date'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)
const OGRETMEN = process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'
const BUGUN = todayLocalISO()
const ETIKET = 'E2E bireysel'

let ogretmen = { id: '', school_id: '' }
let ogr = { id: '', full_name: '', class_id: '' }
const ogrenciSayfasi = () => `/siniflar/${ogr.class_id}/ogrenciler/${ogr.id}`
const kayitlar = async () => (await db.from('bireysel_odevler').select('id, aciklama, yapildi, teslim_tarihi, ogretmen_id')
  .eq('ogrenci_id', ogr.id).like('aciklama', `${ETIKET}%`)).data!
const ekleDb = (aciklama: string, teslim: string | null, yapildi = false) => db.from('bireysel_odevler').insert({
  school_id: ogretmen.school_id, ogrenci_id: ogr.id, ogretmen_id: ogretmen.id, aciklama: `${ETIKET} ${aciklama}`, teslim_tarihi: teslim,
  yapildi, yapildi_tarihi: yapildi ? new Date().toISOString() : null,
})
const satir = (page: Page, aciklama: string) => page.getByRole('listitem', { name: `${ETIKET} ${aciklama}` })

test.describe.configure({ mode: 'serial' })
test.use({ storageState: AUTH('ogretmen') })

test.beforeAll(async () => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const uid = data.users.find(u => u.email === OGRETMEN)!.id
  ogretmen = (await db.from('profiles').select('id, school_id').eq('id', uid).single()).data!
  ogr = (await db.from('students').select('id, full_name, class_id').eq('school_id', ogretmen.school_id).is('deleted_at', null).limit(1).single()).data!
})
test.afterAll(async () => {
  await db.from('bireysel_odevler').delete().eq('ogrenci_id', ogr.id).like('aciklama', `${ETIKET}%`)
})

test('öğrenci sayfasından ekle → listede, DB\'de öğretmenin kaydı', async ({ page }) => {
  await page.goto(ogrenciSayfasi())
  const bolum = page.getByRole('region', { name: 'Bireysel ödevler' })
  await bolum.getByRole('button', { name: '+ Bireysel ödev ekle' }).click()
  await bolum.getByLabel('Açıklama').fill(`${ETIKET} Türev testi, s. 45–52`)
  await bolum.getByLabel('Teslim tarihi (isteğe bağlı)').fill(addDaysISO(BUGUN, 3))
  await bolum.getByRole('button', { name: 'Kaydet' }).click()
  await expect(bolum.getByRole('status')).toHaveText('Bireysel ödev eklendi.', { timeout: 15_000 })
  await expect(satir(page, 'Türev testi, s. 45–52')).toContainText('Bekliyor')
  expect(await kayitlar()).toEqual([expect.objectContaining({ aciklama: `${ETIKET} Türev testi, s. 45–52`, yapildi: false, teslim_tarihi: addDaysISO(BUGUN, 3), ogretmen_id: ogretmen.id })])
})

test('teslim tarihi boş bırakılabilir', async ({ page }) => {
  await page.goto(ogrenciSayfasi())
  const bolum = page.getByRole('region', { name: 'Bireysel ödevler' })
  await bolum.getByRole('button', { name: '+ Bireysel ödev ekle' }).click()
  await bolum.getByLabel('Açıklama').fill(`${ETIKET} tarihsiz`)
  await bolum.getByRole('button', { name: 'Kaydet' }).click()
  await expect(satir(page, 'tarihsiz')).toBeVisible({ timeout: 15_000 })
  expect((await kayitlar()).find(k => k.aciklama === `${ETIKET} tarihsiz`)!.teslim_tarihi).toBeNull()
})

test('tek tık yapıldı ve geri al', async ({ page }) => {
  await page.goto(ogrenciSayfasi())
  const s = satir(page, 'Türev testi, s. 45–52')
  await s.getByRole('button', { name: 'Yapıldı' }).click()
  await expect(s).toContainText('Yapıldı', { timeout: 15_000 })
  await expect.poll(async () => (await kayitlar()).find(k => k.aciklama.includes('Türev'))!.yapildi).toBe(true)
  await s.getByRole('button', { name: 'Geri al' }).click()
  await expect.poll(async () => (await kayitlar()).find(k => k.aciklama.includes('Türev'))!.yapildi, { timeout: 15_000 }).toBe(false)
})

test('düzenle ve iki adımlı sil', async ({ page }) => {
  await page.goto(ogrenciSayfasi())
  const s = satir(page, 'tarihsiz')
  await s.getByRole('button', { name: 'Düzenle' }).click()
  await s.getByLabel('Açıklama').fill(`${ETIKET} tarihsiz düzeltildi`)
  await s.getByRole('button', { name: 'Kaydet' }).click()
  await expect.poll(async () => (await kayitlar()).some(k => k.aciklama === `${ETIKET} tarihsiz düzeltildi`), { timeout: 15_000 }).toBe(true)
  const yeni = satir(page, 'tarihsiz düzeltildi')
  await yeni.getByRole('button', { name: 'Sil' }).click()
  await yeni.getByRole('button', { name: 'Emin misin? Sil' }).click()
  await expect.poll(async () => (await kayitlar()).some(k => k.aciklama.includes('tarihsiz')), { timeout: 15_000 }).toBe(false)
})

test('Verdiğim Bireysel Ödevler: gecikmiş kırmızı ve üstte; Bekleyenler / Tümü; öğrenci adı sayfaya gider', async ({ page }) => {
  await ekleDb('yarın', addDaysISO(BUGUN, 1))
  await ekleDb('gecikmiş', addDaysISO(BUGUN, -2))
  await ekleDb('bitti', addDaysISO(BUGUN, -5), true)
  await page.goto('/odevler/bireysel')
  await expect(page.getByRole('heading', { name: 'Verdiğim Bireysel Ödevler' })).toBeVisible({ timeout: 20_000 })
  const liste = page.getByRole('list', { name: 'Bireysel ödevler' })
  const bizim = liste.getByRole('listitem').filter({ hasText: ETIKET })
  await expect(bizim.first()).toContainText('gecikmiş')
  await expect(bizim.first()).toContainText('Gecikti')
  expect(await bizim.first().evaluate(e => getComputedStyle(e).borderColor)).not.toBe(await bizim.nth(1).evaluate(e => getComputedStyle(e).borderColor))
  await expect(liste).not.toContainText(`${ETIKET} bitti`) // varsayılan Bekleyenler
  await page.getByRole('link', { name: 'Tümü' }).click()
  await expect(liste).toContainText(`${ETIKET} bitti`)
  await expect(bizim.last()).toContainText('bitti') // yapılanlar en altta
  await bizim.first().getByRole('link', { name: new RegExp(ogr.full_name) }).click()
  await expect(page).toHaveURL(new RegExp(`${ogrenciSayfasi()}$`))
})

test('telefon: yatay kaydırma yok, düğmeler en az 44px, menüde bağlantı', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/odevler/bireysel?filtre=tumu')
  await expect(page.getByRole('heading', { name: 'Verdiğim Bireysel Ödevler' })).toBeVisible({ timeout: 20_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const dugme = page.getByRole('list', { name: 'Bireysel ödevler' }).getByRole('button', { name: /^(Yapıldı|Geri al)$/ }).first()
  expect((await dugme.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.goto(ogrenciSayfasi())
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto('/anasayfa')
  await page.getByRole('button', { name: 'Daha fazla' }).click()
  await page.getByRole('link', { name: 'Verdiğim Bireysel Ödevler' }).click()
  await expect(page).toHaveURL(/\/odevler\/bireysel$/)
})

test('başka öğretmen göremez; müdür yardımcısı ekranı açamaz', async ({ browser }) => {
  const zb = await browser.newContext({ storageState: AUTH('zumre_baskani') })
  const p = await zb.newPage()
  await p.goto(ogrenciSayfasi())
  await expect(p.getByRole('region', { name: 'Bireysel ödevler' })).toBeVisible({ timeout: 20_000 })
  await expect(p.getByRole('region', { name: 'Bireysel ödevler' })).not.toContainText(ETIKET)
  await p.goto('/odevler/bireysel?filtre=tumu')
  await expect(p.getByRole('heading', { name: 'Verdiğim Bireysel Ödevler' })).toBeVisible({ timeout: 20_000 })
  await expect(p.locator('main')).not.toContainText(ETIKET)
  await zb.close()
  const my = await browser.newContext({ storageState: AUTH('mudur_yardimcisi') })
  const m = await my.newPage()
  await m.goto('/odevler/bireysel')
  await expect(m).toHaveURL(/\/anasayfa/, { timeout: 20_000 })
  await m.goto(ogrenciSayfasi())
  await expect(m.getByRole('region', { name: 'Bireysel ödevler' })).toHaveCount(0)
  await my.close()
})
