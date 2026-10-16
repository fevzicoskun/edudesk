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
  await expect(page.getByRole('heading', { name: /Haftalık (Takip|Çalışma Planı|Mentörlük Raporu)/ })).toHaveCount(0)
}
const kaydedildi = (page: Page) => expect(page.getByRole('status').filter({ hasText: 'Kaydedildi' })).toBeVisible({ timeout: 15_000 })

test('yalnız bakmak satır yaratmaz; düzenleme kaydedilir ve yenilemede kalır', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Takip' })).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1500)
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
  // Başlık KÂĞITTA da görünmeli: globals.css baskıda <header>'ları gizliyor (2026-10-16 görsel kontrolde yakalandı)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Program' })).toBeVisible()
  await expect(page.locator('.filigran img')).toHaveCount(1)
  const kenar = await page.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
    .filter((r): r is CSSPageRule => r instanceof CSSPageRule && !!r.style.margin).map(r => r.style.margin))
  expect(kenar).toEqual(['0px'])
})

test('kâğıt: 24 görev + 12 okul ödeviyle tek A4 sayfa (2026-10-16 kullanıcı: 2 sayfaya taşıyordu)', async ({ page }) => {
  const { data: o } = await db.from('students').select('class_id').eq('id', ogrId).single()
  const { data: eklenen, error } = await db.from('homeworks').insert(Array.from({ length: 12 }, (_, i) => ({
    teacher_id: mentor.id, class_id: o!.class_id, school_id: mentor.school_id, subject: 'Fizik',
    title: `E2E kâğıt ödevi ${i + 1} biraz uzunca bir başlık`, due_date: `2026-10-${19 + (i % 5)}`,
  }))).select('id')
  if (error) throw new Error(error.message)
  try {
    await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
    await expect(page.getByRole('table', { name: 'Okul ödevleri' }).first()).toBeVisible({ timeout: 20_000 })
    await page.emulateMedia({ media: 'print' })
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const bayt = await page.pdf({ format: 'A4', preferCSSPageSize: true })
    if (process.env.KAGIT_PDF) (await import('fs')).writeFileSync(process.env.KAGIT_PDF, bayt) // elle görsel kontrol
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bayt) }).promise
    expect(pdf.numPages).toBe(1)
  } finally {
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
  await expect(page.getByLabel('Kitap').first()).toHaveValue(/.+/)
  await expect(page.getByLabel('Kitap').first().locator('option:checked')).toHaveText('E2E Soru Bankası')
})
test('sonuç: kâğıttan işleme → yenile → yerinde; doğru>soru girilemez', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`)
  const satir = page.getByRole('row', { name: /Matematik soru bankası/ }).first()
  await satir.getByRole('checkbox', { name: 'Yaptı' }).check()
  await satir.getByLabel('Soru').fill('40')
  await satir.getByLabel('Doğru').fill('50')
  await expect(satir.getByLabel('Doğru')).toHaveValue('40') // sorudan büyük girilemez
  await satir.getByLabel('Doğru').fill('30')
  await kaydedildi(page)
  await page.reload()
  await expect(page.getByRole('row', { name: /Matematik soru bankası/ }).first().getByLabel('Soru')).toHaveValue('40')
  await expect(page.getByText('Doğruluk').locator('..')).toContainText('%75')
  const { data } = await db.from('mentor_haftalari').select('soru, dogru, islendi').eq('student_id', ogrId).single()
  expect(data).toEqual({ soru: 40, dogru: 30, islendi: true })
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
    for (const yol of ['takip', 'takip/kagit', 'takip/veli-raporu']) await bulunamadi(p, `/mentorluk/${ogrId}/${yol}?hafta=2026-10-19`)
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
