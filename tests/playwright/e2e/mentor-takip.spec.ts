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
})

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
