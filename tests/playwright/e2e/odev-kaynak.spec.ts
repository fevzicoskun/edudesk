import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-28: aynı adlı iki kitap (ör. "Mikro Orjinal" Matematik / Geometri).
 *  - Ödev formunda yazılan kaynak, ödevin DERSİNE uyan kitaba bağlanır (önceden rastgele biri).
 *  - Ayarlar'dan aynı ad + aynı ders ikinci kez eklenemez; harf/boşluk farkı yeni kayıt açmaz.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

/** Sunucudan gelen form görünür ve düğmesi aktif olsa da React devralmadan (hydration) yazılan
 *  değerler sıfırlanır — alan React'e bağlanana dek bekle (tam pakette yavaş hydration'da yakalandı). */
async function formHazir(page: import('@playwright/test').Page) {
  await expect.poll(() => page.locator('input[name="title"]').evaluate(el =>
    Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 30_000 }).toBe(true)
}

const ETIKET = `E2EKAYNAK${Date.now()}`
const KITAP = `${ETIKET} Mikro Orjinal`
let ogretmenId = '', schoolId = '', matId = '', geoId = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  ogretmenId = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  schoolId = p!.school_id as string
  // Matematik önce (daha eski) — eski davranış hep bunu seçerdi
  const { data: mat, error } = await db.from('homework_sources')
    .insert({ teacher_id: ogretmenId, school_id: schoolId, name: KITAP, subject: 'Matematik' }).select('id').single()
  if (error) throw error
  const { data: geo, error: e2 } = await db.from('homework_sources')
    .insert({ teacher_id: ogretmenId, school_id: schoolId, name: KITAP, subject: 'Geometri' }).select('id').single()
  if (e2) throw e2
  matId = mat!.id as string
  geoId = geo!.id as string
})

test.afterAll(async () => {
  const { data } = await db.from('homeworks').select('id').like('title', `${ETIKET}%`)
  const ids = (data ?? []).map(h => h.id)
  if (ids.length) {
    await db.from('homework_submissions').delete().in('homework_id', ids)
    await db.from('homeworks').delete().in('id', ids)
  }
  await db.from('homework_sources').delete().like('name', `${ETIKET}%`)
})

test('ödev formunda yazılan kaynak, ödevin dersine uyan kitaba bağlanır', async ({ page }) => {
  const baslik = `${ETIKET} geometri ödevi`
  await page.goto('/odevler/yeni')
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await formHazir(page)

  await page.locator('input[name="subject"]').fill('Geometri')
  // harf ve boşluk farkıyla yazılır — yine aynı kitap olmalı
  await page.locator('#hw-source').fill(`${ETIKET}  mikro ORJİNAL `)
  await page.locator('input[name="title"]').fill(baslik)
  const bugun = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  await page.getByLabel('Son Teslim Tarihi').fill(bugun)
  await expect(page.locator('input[name="subject"]')).toHaveValue('Geometri')
  await expect(page.locator('input[name="title"]')).toHaveValue(baslik)

  await gonder.click()
  await expect(page).toHaveURL(/\/odevler\/[0-9a-f-]{36}/, { timeout: 30_000 })

  const { data } = await db.from('homeworks').select('source_id, subject').eq('title', baslik).single()
  expect(data).toEqual({ source_id: geoId, subject: 'Geometri' })
  // yeni kaynak açılmadı
  const { count } = await db.from('homework_sources').select('id', { count: 'exact', head: true }).like('name', `${ETIKET}%`)
  expect(count).toBe(2)
  expect(matId).not.toBe(geoId)
})

test('Ayarlar: aynı ad + aynı ders ikinci kez eklenemez; listede hayalet kopya kalmaz', async ({ page }) => {
  await page.goto('/ayarlar#kaynaklar')
  const bolum = page.locator('#kaynaklar')
  await expect(bolum.getByText(KITAP).first()).toBeVisible({ timeout: 20_000 })
  const form = bolum.locator('form')
  await expect(async () => {
    await form.locator('input[name="name"]').fill(`  ${ETIKET.toLowerCase()} mikro   orjinal`, { timeout: 2_000 })
    await form.locator('input[name="subject"]').fill('matematik')
    await form.getByRole('button', { name: 'Ekle' }).click()
    await expect(bolum.getByText(/zaten kaynaklarınızda var/)).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 30_000 })

  const { count } = await db.from('homework_sources').select('id', { count: 'exact', head: true }).like('name', `${ETIKET}%`)
  expect(count).toBe(2)
  // iyimser eklenen satır geri alınmış olmalı: kitap listede yalnız 2 kez (Matematik + Geometri)
  await expect(bolum.getByText(KITAP, { exact: true })).toHaveCount(2)
})

test('Romen rakamı ve rakam tekrarı içeren başlık kaydedilir ("Ünite III · sayfa 1000")', async ({ page }) => {
  const baslik = `${ETIKET} Ünite III · sayfa 1000...`
  await page.goto('/odevler/yeni')
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await formHazir(page)
  await page.locator('input[name="title"]').fill(baslik)
  await page.locator('input[name="subject"]').fill('Matematik')
  const bugun = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  await page.getByLabel('Son Teslim Tarihi').fill(bugun)
  await expect(page.locator('input[name="title"]')).toHaveValue(baslik)

  await gonder.click()
  await expect(page).toHaveURL(/\/odevler\/[0-9a-f-]{36}/, { timeout: 30_000 })
  const { data } = await db.from('homeworks').select('title').eq('title', baslik).single()
  expect(data?.title).toBe(baslik)
})
