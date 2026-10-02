import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-29: /rapor/ogretmen-aktivite MY'de herkesi 0 ve "Pasif" gösteriyordu —
 * teacher_activity_log'da yöneticinin okuma izni yoktu (yalnız "kendi kaydını oku").
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/mudur_yardimcisi.json') })

const ETIKET = `E2EAKTIVITE${Date.now()}`
let ogr = { id: '', ad: '', school_id: '' }

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const id = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('full_name, school_id').eq('id', id).single()
  ogr = { id, ad: p!.full_name as string, school_id: p!.school_id as string }
  const { error } = await db.from('teacher_activity_log').insert({
    teacher_id: ogr.id, school_id: ogr.school_id, action: 'odev_eklendi', meta: { title: ETIKET },
  })
  if (error) throw error
})

test.afterAll(async () => {
  await db.from('teacher_activity_log').delete().eq('teacher_id', ogr.id).contains('meta', { title: ETIKET })
})

test('MY aktivite raporunda öğretmenin işlemleri görünür; aktif sayısı 0 değildir', async ({ page }) => {
  await page.goto('/rapor/ogretmen-aktivite')
  const satir = page.locator('tr', { hasText: ogr.ad })
  await expect(satir).toBeVisible({ timeout: 20_000 })
  // Ödev sütunu ≥1, son aktivite boş değil
  const hucreler = satir.locator('td')
  expect(Number(await hucreler.nth(3).textContent())).toBeGreaterThanOrEqual(1)
  await expect(hucreler.last()).not.toHaveText('—')
  // Aktif Öğretmen kartı 0 değil
  const aktifKart = page.getByText('Aktif Öğretmen', { exact: true }).locator('..')
  const aktifSayi = Number(((await aktifKart.textContent()) ?? '').match(/\d+/)?.[0] ?? '0')
  expect(aktifSayi).toBeGreaterThanOrEqual(1)
  // Aktivite akışında bu kayıt var
  await expect(page.getByText(ETIKET).first()).toBeVisible()
})
