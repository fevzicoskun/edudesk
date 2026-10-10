import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-29: MY "Ödev Takibi" (/yonetim/odevler) — ders bazlı sayılar + giren öğretmen,
 * ders çipiyle süzme, kontrol edilecek/edilen listeleri, riskli öğrenciler ve geciken kontroller.
 */
const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DERS = `E2ETakip${Date.now()}`
const gun = (fark: number) => {
  const bugun = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const [y, m, d] = bugun.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + fark)).toISOString().slice(0, 10)
}
const ids: string[] = []
let ogrenci = { id: '', ad: '' }
let ogretmenAd = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogretmenId = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id, full_name').eq('id', ogretmenId).single()
  const schoolId = p!.school_id as string
  ogretmenAd = p!.full_name as string

  const { data: st } = await db.from('students').select('id, full_name, class_id')
    .eq('school_id', schoolId).is('deleted_at', null).limit(1).single()
  if (!st) throw new Error('test okulunda öğrenci yok')
  ogrenci = { id: st.id as string, ad: st.full_name as string }

  const satir = (title: string, due_date: string) => ({
    teacher_id: ogretmenId, title, school_id: schoolId, class_id: st.class_id, subject: DERS,
    is_template: false, assigned_date: gun(-10), due_date,
  })
  const { data, error } = await db.from('homeworks').insert([
    satir(`${DERS} işaretli 1`, gun(-8)),
    satir(`${DERS} işaretli 2`, gun(-7)),
    satir(`${DERS} işaretli 3`, gun(-6)),
    satir(`${DERS} işaretli 4`, gun(-6)),
    satir(`${DERS} işaretli 5`, gun(-6)),
    satir(`${DERS} bekleyen`, gun(-5)),
  ]).select('id, title')
  if (error) throw error
  ids.push(...data!.map(h => h.id))

  const isaretli = data!.filter(h => h.title.includes('işaretli')).map(h => h.id)
  // Ödev eklenince teslim satırları otomatik açılır; yoksa ekle
  const { error: e2 } = await db.from('homework_submissions').upsert(
    // 5 kontrol edilmiş ödevin 3'ü yapılmadı → %60 (riskli eşiği %30, en az 5 ödev)
    isaretli.map((homework_id, i) => ({
      homework_id, student_id: ogrenci.id, school_id: schoolId,
      status: i < 3 ? 'yapilmadi' : 'yapildi', marked_at: new Date().toISOString(),
    })),
    { onConflict: 'homework_id,student_id' },
  )
  if (e2) throw e2
})

test.afterAll(async () => {
  if (!ids.length) return
  await db.from('homework_submissions').delete().in('homework_id', ids)
  await db.from('homeworks').delete().in('id', ids)
})

test.describe('MY Ödev Takibi', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur_yardimcisi.json') })

  test('ders satırı, kontrol listeleri ve riskliler', async ({ page }) => {
    await page.goto('/yonetim/odevler')
    await expect(page.getByRole('heading', { name: 'Ödev Takibi', level: 1 })).toBeVisible({ timeout: 20_000 })

    const ders = page.getByTestId('ders-satirlari').locator('tbody tr', { hasText: DERS })
    await expect(ders.locator('td').nth(1)).toHaveText('6')
    await expect(ders).toContainText(`${ogretmenAd} 6`)
    await expect(ders).toContainText('5 kontrol edildi')
    await expect(ders).toContainText('%40') // 2 yapıldı / 5 işaret
    await expect(ders).toContainText('1 kontrol edilecek')

    const bekleyen = page.getByTestId('kontrol-edilecek').locator('li', { hasText: `${DERS} bekleyen` })
    await expect(bekleyen).toContainText('5 gündür bekliyor')
    await expect(bekleyen.locator('.text-red-700')).toHaveCount(1) // 3 günü aştı → gecikmiş (kırmızı)
    await expect(page.getByTestId('geciken-ozet')).toBeVisible()

    const edilen = page.getByTestId('kontrol-edilen').or(page.locator('details ul')).locator('li', { hasText: `${DERS} işaretli 1` })
    await expect(edilen.first()).toContainText('1 yapılmadı')
  })

  test('ders süzmesinde sınıf tamamlanması ve %30 kuralıyla riskli öğrenci', async ({ page }) => {
    await page.goto(`/yonetim/odevler?ders=${encodeURIComponent(DERS.toLocaleLowerCase('tr'))}`)
    await expect(page.getByRole('heading', { name: 'Ödev Takibi', level: 1 })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('sinif-satirlari').locator('li')).toHaveCount(1)
    await expect(page.getByTestId('sinif-satirlari')).toContainText('%40')
    const riskli = page.getByTestId('riskli-ogrenciler').locator('li', { hasText: ogrenci.ad })
    await expect(riskli).toContainText('%60')
    await expect(riskli).toContainText(`3/5 · ${DERS} 3`)
  })

  test('ders çipi listeleri o derse süzer', async ({ page }) => {
    await page.goto('/yonetim/odevler')
    const cipler = page.getByRole('navigation', { name: 'Derse göre süz' })
    await cipler.getByRole('link', { name: DERS }).click()
    await expect(page).toHaveURL(/\?ders=/, { timeout: 20_000 })
    await expect(cipler.getByRole('link', { name: DERS })).toHaveAttribute('aria-current', 'page')
    await expect(cipler.getByRole('link', { name: 'Tümü' })).not.toHaveAttribute('aria-current', 'page')

    const satirlar = page.getByTestId('kontrol-edilecek').locator('li')
    await expect(satirlar).toHaveCount(1)
    await expect(satirlar.first()).toContainText(`${DERS} bekleyen`)
    await expect(page.getByTestId('ders-satirlari').locator('tbody tr')).toHaveCount(1)
  })

  test('okul karnesi PDF\'i ödev bölümlerini ve okuma rehberini içerir', async ({ page }) => {
    await page.goto('/yonetim')
    const indir = page.getByRole('button', { name: 'Karne (PDF) indir' })
    await expect(indir).toBeVisible({ timeout: 20_000 })
    const [dosya] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), indir.click()])
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync((await dosya.path())!)) }).promise
    let metin = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const icerik = await (await pdf.getPage(i)).getTextContent()
      metin += icerik.items.map(it => ('str' in it ? it.str : '')).join(' ') + '\n'
    }
    for (const s of ['Okul Karnesi — Ödev Takibi', 'Bu rapor nasıl okunur', 'Derslere göre', 'Sınıflara göre tamamlanma',
      'Öğretmenlere göre', 'Riskli öğrenciler', 'Bekleyen kontroller', DERS, ogrenci.ad]) {
      expect(metin, s).toContain(s)
    }
  })

  test('menüde yalnız Ödev Takibi aktif (Okul Durumu yanmaz)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/yonetim/odevler')
    const aside = page.locator('aside').first()
    await expect(aside.getByRole('link', { name: 'Ödev Takibi' })).toHaveAttribute('aria-current', 'page', { timeout: 20_000 })
    await expect(aside.getByRole('link', { name: 'Okul Durumu' })).not.toHaveAttribute('aria-current', 'page')
  })

  test('ana sayfadan tek tıkla ulaşılır', async ({ page }) => {
    await page.goto('/anasayfa')
    await page.getByRole('main').getByRole('link', { name: 'Ödev Takibi →' }).click()
    await expect(page).toHaveURL(/\/yonetim\/odevler$/, { timeout: 20_000 })
  })
})

test.describe('Yetki', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('öğretmen Ödev Takibi sayfasına giremez', async ({ page }) => {
    await page.goto('/yonetim/odevler')
    await expect(page).toHaveURL(/\/anasayfa/, { timeout: 20_000 })
  })
})
