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

// Kayıtta her kelimenin baş harfi büyütülür (2026-10-12) → etiket zaten o biçimde, aramalar bozulmasın
const ETIKET = `E2Ekaynak${Date.now()}`
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
  const kayitli = `${ETIKET} Geometri Ödevi` // her kelimenin baş harfi büyük kaydedilir
  await page.goto('/odevler/yeni')
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await formHazir(page)

  await page.locator('select[name="subject"]').selectOption('Geometri')
  // Listede yok yolu: "yeni yaz" seçilir, harf ve boşluk farkıyla yazılır — yine aynı kitap olmalı
  await page.locator('select#hw-source').selectOption('__yeni__')
  await page.locator('input#hw-source').fill(`${ETIKET}  mikro ORJİNAL `)
  await page.locator('input[name="title"]').fill(baslik)
  const bugun = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  await page.getByLabel('Son Teslim Tarihi').fill(bugun)
  await expect(page.locator('select[name="subject"]')).toHaveValue('Geometri')
  await expect(page.locator('input[name="title"]')).toHaveValue(baslik)

  await gonder.click()
  await expect(page).toHaveURL(/\/odevler\/[0-9a-f-]{36}/, { timeout: 30_000 })

  const { data } = await db.from('homeworks').select('source_id, subject').eq('title', kayitli).single()
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
  const kayitli = `${ETIKET} Ünite III · Sayfa 1000...` // Romen rakamı büyük kalır, diğer kelimeler baş harf
  await page.goto('/odevler/yeni')
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await formHazir(page)
  await page.locator('input[name="title"]').fill(baslik)
  await page.locator('select[name="subject"]').selectOption('Matematik')
  const bugun = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  await page.getByLabel('Son Teslim Tarihi').fill(bugun)
  await expect(page.locator('input[name="title"]')).toHaveValue(baslik)

  await gonder.click()
  await expect(page).toHaveURL(/\/odevler\/[0-9a-f-]{36}/, { timeout: 30_000 })
  const { data } = await db.from('homeworks').select('title').eq('title', kayitli).single()
  expect(data?.title).toBe(kayitli)
})

test('kitap önce listeden seçilir: seçilen kitap ödeve bağlanır, başlık önerisi gelir', async ({ page }) => {
  const kayitli = `${ETIKET} Mikro Orjinal · S.12-14`
  await page.goto('/odevler/yeni')
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await formHazir(page)

  await page.locator('select[name="subject"]').selectOption('Geometri')
  // Aynı adlı iki kitap dersle ayrışır; seçim kutusu seçileni gösterir (ilkini değil)
  await page.locator('select#hw-source').selectOption({ label: `${ETIKET} Mikro Orjinal · Geometri` })
  await expect(page.locator('select#hw-source')).toHaveValue(geoId)
  await page.getByLabel('Sayfa aralığı').fill('12-14')
  const bugun = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  await page.getByLabel('Son Teslim Tarihi').fill(bugun)
  await expect(page.locator('input[name="title"]')).toHaveValue(`${ETIKET} Mikro Orjinal · s.12-14`)

  await gonder.click()
  await expect(page).toHaveURL(/\/odevler\/[0-9a-f-]{36}/, { timeout: 30_000 })
  const { data } = await db.from('homeworks').select('source_id').eq('title', kayitli).single()
  expect(data).toEqual({ source_id: geoId })
})

test('Ayarlar → Düzenle: kitabın adı değişir, ödev aynı kitaba (id) bağlı kalır', async ({ page }) => {
  await page.goto('/ayarlar')
  const liste = page.locator('#kaynaklar')
  await liste.getByRole('button', { name: `${KITAP} adını düzenle` }).first().click()
  const kutu = liste.getByRole('textbox', { name: `${KITAP} yeni adı` })
  await kutu.fill(`${ETIKET} mikro orijinal`)
  await liste.getByRole('button', { name: 'Kaydet' }).click()
  await expect(liste.getByText(`${ETIKET} Mikro Orijinal`, { exact: true })).toBeVisible({ timeout: 15_000 })
  const { data } = await db.from('homework_sources').select('id, name').like('name', `${ETIKET}%`).order('created_at')
  expect(data!.map(k => k.name)).toContain(`${ETIKET} Mikro Orijinal`)
  // Bağ id ile: yeniden adlandırılan kitaba bağlı ödevler hâlâ bağlı (başlıktaki kopya ad değişmez)
  const { count } = await db.from('homeworks').select('id', { count: 'exact', head: true }).in('source_id', data!.map(k => k.id))
  expect(count).toBeGreaterThan(0)
})
