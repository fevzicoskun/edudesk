import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-10-17: React 19 `<form action>` sunucu hata döndürse de formu sıfırlar — defaultValue'lu
 * alanlar (açıklama, ders) ilk hâline döner, öğretmenin yazdığı kaybolur. Hata sonrası yazılanlar kalmalı.
 * Hata yolu: 2000 karakteri aşan açıklama (sunucu zod'u reddeder, kayıt oluşmaz).
 */
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const istanbulGun = (gunOnce: number) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - gunOnce * 864e5))

test('yeni ödev: sunucu hatasından sonra açıklama ve ders silinmez', async ({ page }) => {
  await page.goto('/odevler/yeni')
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await expect.poll(() => page.locator('input[name="title"]').evaluate(el =>
    Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 30_000 }).toBe(true)

  const ACIKLAMA = 'Uzun açıklama — kaybolmamalı. '.repeat(80) // > 2000 karakter
  await page.locator('input[name="title"]').fill(`E2Ehata${Date.now()}`)
  await page.locator('select[name="subject"]').selectOption('Kimya')
  const aciklama = page.locator('textarea[name="description"]')
  await expect(aciklama).toHaveAttribute('maxlength', '2000') // önleme katmanı: tarayıcı sınırı
  // Kök neden katmanı: sınır aşılıp sunucu reddetse de (ör. eski sekme) yazılan kalmalı
  await aciklama.evaluate(el => el.removeAttribute('maxlength'))
  await aciklama.fill(ACIKLAMA)
  await page.getByLabel('Son Teslim Tarihi').fill(istanbulGun(-2))

  await gonder.click()
  await expect(page.locator('[data-hw-error]')).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/\/odevler\/yeni/)
  await expect(page.locator('textarea[name="description"]')).toHaveValue(ACIKLAMA)
  await expect(page.locator('select[name="subject"]')).toHaveValue('Kimya')
})

// ── Kalan formlar (2026-10-17): kaynak ekleme, öğrenci notu, öğrenci ekleme ─────────────────────
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const ETIKET = `E2eform${Date.now()}` // baş-harf kuralında değişmeyen biçim
let classId = '', studentId = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogretmenId = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  const { data: c } = await db.from('students').select('class_id').eq('school_id', p!.school_id).is('deleted_at', null).limit(1).single()
  classId = c!.class_id as string
  const { data: s, error } = await db.from('students')
    .insert({ full_name: `${ETIKET} Öğrenci`, class_id: classId, school_id: p!.school_id }).select('id').single()
  if (error) throw error
  studentId = s!.id as string
})

test.afterAll(async () => {
  await db.from('student_notes').delete().eq('student_id', studentId)
  await db.from('students').delete().eq('id', studentId)
  await db.from('students').delete().like('full_name', `${ETIKET}%`)
  await db.from('homework_sources').delete().like('name', `${ETIKET}%`)
})

/** Sunucu sınırını aşan metni (maxlength kaldırılarak) yazar — sunucu reddeder, yazılan kalmalı. */
async function sinirAsiyor(alan: import('@playwright/test').Locator, sinir: number, metin: string) {
  await expect(alan).toHaveAttribute('maxlength', String(sinir))
  await alan.evaluate(el => el.removeAttribute('maxlength'))
  await alan.fill(metin)
}
const hydrate = (page: import('@playwright/test').Page, sel: string) =>
  expect.poll(() => page.locator(sel).first().evaluate(el => Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 30_000 }).toBe(true)

test('kaynak ekleme: hatada ad kalır, başarıda temizlenir', async ({ page }) => {
  await page.goto('/ayarlar#kaynaklar')
  const ad = page.getByPlaceholder('Kaynak adı (örn. Kondisyon Soru Bankası)')
  await hydrate(page, 'input[placeholder^="Kaynak adı"]')
  const UZUN = `${ETIKET} ` + 'x'.repeat(120)
  await sinirAsiyor(ad, 100, UZUN)
  await page.locator('#kaynaklar').getByRole('button', { name: 'Ekle' }).click()
  await expect(page.locator('#kaynaklar p.text-red-600')).toBeVisible({ timeout: 30_000 })
  await expect(ad).toHaveValue(UZUN)

  await ad.fill(`${ETIKET} Kitap`)
  await page.locator('#kaynaklar').getByRole('button', { name: 'Ekle' }).click()
  await expect(page.locator('#kaynaklar li', { hasText: `${ETIKET} Kitap` })).toBeVisible({ timeout: 30_000 })
  await expect(ad).toHaveValue('', { timeout: 30_000 })
})

test('öğrenci notu: hatada not kalır (hata sayfası yok), başarıda kaydedilip temizlenir', async ({ page }) => {
  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}`)
  const not = page.getByPlaceholder('Kısa not yaz...')
  await hydrate(page, 'textarea[placeholder="Kısa not yaz..."]')
  const UZUN = 'Uzun not. '.repeat(120) // > 1000
  await sinirAsiyor(not, 1000, UZUN)
  await page.getByRole('button', { name: 'Not Ekle' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Yazdıklarınız duruyor' })).toBeVisible({ timeout: 30_000 })
  await expect(not).toHaveValue(UZUN)

  await not.fill(`${ETIKET} kısa not`)
  await page.getByRole('button', { name: 'Not Ekle' }).click()
  await expect(page.getByText(`${ETIKET} kısa not`).first()).toBeVisible({ timeout: 30_000 })
  await expect(not).toHaveValue('')
  const { data } = await db.from('student_notes').select('body').eq('student_id', studentId)
  expect(data).toEqual([{ body: `${ETIKET} kısa not` }]) // uzun not yazılmadı, kısa not bir kez
})

test.describe('müdür', () => {
  test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/mudur.json') })

  test('öğrenci ekleme: hatada ad kalır, başarıda eklenip temizlenir', async ({ page }) => {
    await page.goto(`/siniflar/${classId}`)
    const ad = page.getByPlaceholder('Ad Soyad')
    await hydrate(page, 'input[placeholder="Ad Soyad"]')
    const UZUN = `${ETIKET} ` + 'Ad'.repeat(70) // > 120
    await sinirAsiyor(ad, 120, UZUN)
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Yazdıklarınız duruyor' })).toBeVisible({ timeout: 30_000 })
    await expect(ad).toHaveValue(UZUN)

    await ad.fill(`${ETIKET} Yeni`)
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    await expect(ad).toHaveValue('', { timeout: 30_000 })
    const { data } = await db.from('students').select('id').eq('full_name', `${ETIKET} Yeni`)
    expect(data).toHaveLength(1)
  })
})
