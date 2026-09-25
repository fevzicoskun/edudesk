import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-25: öğretmen kendi ödevini silemiyordu (RLS 42501 — silinmiş satırı SELECT policy
 * gizliyordu); silme RPC'ye taşındı ve silme sonrası 10 sn "Geri al" eklendi.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const BASLIK = `E2ESIL${Date.now()}`
let hwId = ''

test.beforeAll(async () => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogretmenId = data.users.find(u => u.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  const { data: st } = await db.from('students').select('class_id')
    .eq('school_id', p!.school_id).is('deleted_at', null).limit(1).single()
  const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)
  const { data: hw, error } = await db.from('homeworks').insert({
    teacher_id: ogretmenId, title: BASLIK, school_id: p!.school_id,
    class_id: st!.class_id, subject: 'Test', is_template: false, due_date: due,
  }).select('id').single()
  if (error) throw error
  hwId = hw!.id
})

test.afterAll(async () => {
  if (!hwId) return
  await db.from('homework_submissions').delete().eq('homework_id', hwId)
  await db.from('homeworks').delete().eq('id', hwId)
})

const silindiMi = async () =>
  (await db.from('homeworks').select('deleted_at').eq('id', hwId).single()).data!.deleted_at !== null

test('öğretmen kendi ödevini siler, 10 sn içinde geri alır', async ({ page }) => {
  await page.goto(`/odevler?q=${BASLIK}`)
  const satir = page.getByRole('link', { name: BASLIK })
  await expect(satir).toBeVisible({ timeout: 20_000 })

  await expect(async () => {
    await satir.hover()
    await page.getByRole('button', { name: `"${BASLIK}" ödevini sil` }).click({ timeout: 2_000 })
    await expect(page.getByText(`"${BASLIK}" silinsin mi?`)).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Sil', exact: true }).click()

  const bildirim = page.getByRole('status').filter({ hasText: '1 ödev silindi.' })
  await expect(bildirim).toBeVisible({ timeout: 20_000 }) // bildirim sunucu silmeyi onaylayınca çıkar; dolu sunucuda 5 sn yetmiyor
  await expect.poll(silindiMi).toBe(true)

  await bildirim.getByRole('button', { name: 'Geri al' }).click()
  await expect.poll(silindiMi).toBe(false)
  await expect(page.getByRole('link', { name: BASLIK })).toBeVisible({ timeout: 20_000 })
})
