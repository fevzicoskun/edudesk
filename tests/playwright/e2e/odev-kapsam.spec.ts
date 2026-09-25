import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-24 istekleri:
 *  - öğretmen yalnız kendi ödevini, zümre başkanı zümresini (aynı branş), müdür hepsini görür
 *  - ana sayfada "Bugün Verdiğim Ödevler" paneli
 *  - aramada öğrenciye tıklayınca doğrudan öğrencinin sayfası
 *  - öğrencinin yazdırılabilir ödev özeti
 */
const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')
const auth = (rol: string) => path.join(AUTH_DIR, `${rol}.json`)
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ETIKET = `E2EKAPSAM${Date.now()}`
const baslik = { ogr: `${ETIKET} ogretmen`, zb: `${ETIKET} zumre`, mudur: `${ETIKET} mudur` }
const ids: Record<string, string> = {}
let classId = ''
let ogrenci = { id: '', full_name: '' }

async function profilId(email: string) {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const u = data.users.find(x => x.email === email)
  if (!u) throw new Error(`test kullanıcısı yok: ${email}`)
  return u.id
}

test.beforeAll(async () => {
  const ogretmenId = await profilId(process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example')
  const zbId       = await profilId(process.env.TEST_EMAIL_ZUMRE_BASKANI ?? 'test_zumre_baskani@test.example')
  const mudurId    = await profilId(process.env.TEST_EMAIL_MUDUR ?? 'test_mudur@test.example')
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  const schoolId = p!.school_id as string

  const { data: st } = await db.from('students').select('id, full_name, class_id')
    .eq('school_id', schoolId).is('deleted_at', null).limit(1).single()
  if (!st) throw new Error('test okulunda öğrenci yok')
  classId = st.class_id as string
  ogrenci = { id: st.id as string, full_name: st.full_name as string }

  const satir = (teacher_id: string, title: string) =>
    ({ teacher_id, title, school_id: schoolId, class_id: classId, subject: 'Test', is_template: false })
  const { data, error } = await db.from('homeworks')
    .insert([satir(ogretmenId, baslik.ogr), satir(zbId, baslik.zb), satir(mudurId, baslik.mudur)])
    .select('id, title')
  if (error) throw error
  for (const h of data!) ids[h.title === baslik.ogr ? 'ogr' : h.title === baslik.zb ? 'zb' : 'mudur'] = h.id
})

test.afterAll(async () => {
  const hw = Object.values(ids)
  if (!hw.length) return
  await db.from('homework_submissions').delete().in('homework_id', hw)
  await db.from('homeworks').delete().in('id', hw)
})

async function gorunenBasliklar(page: Page) {
  await page.goto(`/odevler?q=${ETIKET}`)
  await expect(page.locator('main')).toBeVisible()
  // Liste Suspense içinde — ilk kart ya da boş durum gelene kadar bekle
  await expect(page.getByText(baslik.ogr).or(page.getByText(/ödev yok|bulunamadı/i)).first()).toBeVisible({ timeout: 20_000 })
  return {
    ogr:   await page.getByText(baslik.ogr, { exact: true }).count(),
    zb:    await page.getByText(baslik.zb, { exact: true }).count(),
    mudur: await page.getByText(baslik.mudur, { exact: true }).count(),
  }
}

test.describe('Ödev görünürlük kapsamı', () => {
  test.describe('öğretmen', () => {
    test.use({ storageState: auth('ogretmen') })
    test('yalnız kendi ödevini görür, başkasınınkine doğrudan da giremez', async ({ page }) => {
      const g = await gorunenBasliklar(page)
      expect(g.ogr).toBeGreaterThan(0)
      expect(g.zb).toBe(0)
      expect(g.mudur).toBe(0)
      // loading.tsx streaming başlattığı için notFound() HTTP 200 döner — içerikten doğrula
      await page.goto(`/odevler/${ids.zb}`)
      await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText(baslik.zb)).toHaveCount(0)
    })
  })

  test.describe('zümre başkanı', () => {
    test.use({ storageState: auth('zumre_baskani') })
    test('zümresindeki öğretmenin ödevini görür, zümre dışını (müdür) görmez', async ({ page }) => {
      const g = await gorunenBasliklar(page)
      expect(g.ogr).toBeGreaterThan(0)
      expect(g.zb).toBeGreaterThan(0)
      expect(g.mudur).toBe(0)
    })
  })

  test.describe('müdür', () => {
    test.use({ storageState: auth('mudur') })
    test('tüm ödevleri görür', async ({ page }) => {
      const g = await gorunenBasliklar(page)
      expect(g.ogr).toBeGreaterThan(0)
      expect(g.zb).toBeGreaterThan(0)
      expect(g.mudur).toBeGreaterThan(0)
    })
  })
})

test.describe('Öğretmen ana sayfası ve öğrenci', () => {
  test.use({ storageState: auth('ogretmen') })

  test('"Bugün Verdiğim Ödevler" paneli bugünkü ödevi listeler', async ({ page }) => {
    await page.goto('/anasayfa')
    const panel = page.locator('section', { has: page.getByRole('heading', { name: /Bugün Verdiğim Ödevler/ }) })
    await expect(panel).toBeVisible({ timeout: 20_000 })
    await expect(panel.getByText(baslik.ogr)).toBeVisible()
    await expect(panel.getByText(baslik.zb)).toHaveCount(0)
    // sınıf başına ayrı kopyala: panoya yalnız o sınıfın listesi gider
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const { data: cls } = await db.from('classes').select('name').eq('id', classId).single()
    await panel.getByRole('button', { name: `${cls!.name} ödevlerini kopyala` }).click()
    await expect(panel.getByText('Kopyalandı ✓')).toBeVisible()
    const pano = await page.evaluate(() => navigator.clipboard.readText())
    expect(pano.split(/\r?\n/)[0]).toBe(cls!.name) // Windows panosu \n'i \r\n'e çevirir
    expect(pano).toContain(baslik.ogr)
  })

  test('ödevler ekranı: sınıf çipi filtreler, toplu seç açılıp kapanır', async ({ page }) => {
    const { data: cls } = await db.from('classes').select('name').eq('id', classId).single()
    await page.goto('/odevler')
    const filtre = page.getByRole('navigation', { name: 'Sınıf filtresi' })
    await expect(filtre.getByRole('link', { name: 'Tümü' })).toHaveAttribute('aria-current', 'page', { timeout: 20_000 })
    await filtre.getByRole('link', { name: cls!.name }).click()
    await expect(page).toHaveURL(new RegExp(`sinif=${classId}`))
    await expect(filtre.getByRole('link', { name: cls!.name })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: `${cls!.name} öğrenci × ödev tablosu →` })).toBeVisible()
    await expect(page.getByRole('link', { name: baslik.ogr })).toBeVisible()

    await expect(async () => {
      await page.getByRole('button', { name: 'Toplu seç' }).click({ timeout: 2_000 })
      await expect(page.getByRole('button', { name: 'Seçimi bitir' })).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
  })

  test('bugün teslimi olan ödev üstteki kontrol kartında, işaretlenince "Kontrol edildi" olur', async ({ page }) => {
    const bugun = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
    await db.from('homeworks').update({ due_date: bugun }).eq('id', ids.ogr)
    await page.goto('/anasayfa')
    const kart = page.locator('section', { has: page.getByRole('heading', { name: 'Bugün kontrol edilecek ödevler' }) })
    await expect(kart).toBeVisible({ timeout: 20_000 })
    const satir = kart.getByRole('link', { name: new RegExp(baslik.ogr) })
    await expect(satir).toContainText('Kontrol et')

    await db.from('homework_submissions')
      .update({ status: 'yapildi', marked_at: new Date().toISOString() })
      .eq('homework_id', ids.ogr).eq('student_id', ogrenci.id)
    await page.reload()
    await expect(kart.getByRole('link', { name: new RegExp(baslik.ogr) })).toContainText('Kontrol edildi', { timeout: 20_000 })
  })

  test('aramada öğrenciye tıklayınca doğrudan öğrencinin sayfası açılır', async ({ page }) => {
    await page.goto('/anasayfa')
    await expect(page.locator('main')).toBeVisible()
    await expect(async () => {
      await page.keyboard.press('Control+k')
      await expect(page.getByRole('dialog', { name: 'Arama' }).locator('input').first()).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    const dialog = page.getByRole('dialog', { name: 'Arama' })
    // Palet açılışı ile sorgu state'i yarışabiliyor: doldur + sonucu gör birlikte tekrar denenir
    await expect(async () => {
      await dialog.locator('input').first().fill(ogrenci.full_name)
      await expect(dialog.getByText(ogrenci.full_name, { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
    await dialog.getByText(ogrenci.full_name, { exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/siniflar/${classId}/ogrenciler/${ogrenci.id}`), { timeout: 20_000 })
  })

  test('sınıfın tüm öğrenci özetleri tek sayfada; yazdırınca her öğrenci ayrı sayfa', async ({ page }) => {
    await page.goto(`/siniflar/${classId}`)
    await page.getByRole('link', { name: 'Ödev Özetleri' }).click()
    await expect(page).toHaveURL(new RegExp(`/siniflar/${classId}/odev-raporu`), { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Tüm Öğrencilerin Ödev Özetleri' })).toBeVisible({ timeout: 20_000 })

    const { count } = await db.from('students').select('id', { count: 'exact', head: true })
      .eq('class_id', classId).is('deleted_at', null)
    const bolumler = page.locator('section[aria-label]')
    await expect(bolumler).toHaveCount(count!)
    await expect(page.getByRole('region', { name: ogrenci.full_name })).toBeVisible()
    // kapsam: her öğrencide öğretmenin kendi ödevi var, zümre başkanınınki yok
    await expect(page.getByText(baslik.ogr)).toHaveCount(count!)
    await expect(page.getByText(baslik.zb)).toHaveCount(0)

    // Gerçek yazdırma çıktısı: sayfa sayısı ≥ öğrenci sayısı (her öğrenci yeni sayfada başlar)
    await page.emulateMedia({ media: 'print' })
    const pdf = (await page.pdf({ format: 'A4' })).toString('latin1')
    const sayfa = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length
    expect(sayfa).toBeGreaterThanOrEqual(count!)
  })

  test('öğrencinin ödev özeti sayfası açılır ve yazdır düğmesi vardır', async ({ page }) => {
    await page.goto(`/siniflar/${classId}/ogrenciler/${ogrenci.id}/odev-raporu`)
    await expect(page.getByText('Öğrenci Ödev Özeti')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(ogrenci.full_name).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Yazdır/ })).toBeVisible()
    // öğretmenin kendi ödevi var, zümre başkanınınki yok (kapsam)
    await expect(page.getByText(baslik.ogr)).toBeVisible()
    await expect(page.getByText(baslik.zb)).toHaveCount(0)
  })
})
