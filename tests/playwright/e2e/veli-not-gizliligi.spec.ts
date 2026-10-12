import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-10-11: öğretmen notları okul içidir — veli bağlantısında görünmez.
 * Öğretmen ekranında "veli görür" uyarısı yoktu; not yazan öğretmen veliye yazdığını bilmiyordu.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const NOT = `PW gizli not ${Date.now()}`
const BASLANGIC = new Date().toISOString()
let ogretmenId = '', classId = '', studentId = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  ogretmenId = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  const { data: s } = await db.from('students').select('id, class_id').eq('school_id', p!.school_id!).is('deleted_at', null).limit(1).single()
  classId = s!.class_id as string
  studentId = s!.id
  const { error } = await db.from('student_notes').insert({ body: NOT, school_id: p!.school_id!, student_id: studentId, teacher_id: ogretmenId })
  if (error) throw error
})

test.afterAll(async () => {
  await db.from('student_notes').delete().eq('body', NOT)
  await db.from('veli_tokens').delete().eq('issued_by', ogretmenId).gte('created_at', BASLANGIC)
})

test('öğretmen notu öğrenci sayfasında var, veli bağlantısında yok', async ({ page, browser }) => {
  await page.goto(`/siniflar/${classId}/ogrenciler/${studentId}`)
  await expect(page.getByText(NOT).first()).toBeVisible({ timeout: 20_000 })

  const linkText = page.getByText(/…\/veli\/v1\./)
  await expect(async () => {
    await page.getByRole('button', { name: /Veli Linkini Oluştur|Yeni Link Oluştur/ }).click()
    await expect(linkText).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 30_000 })
  const token = ((await linkText.textContent()) ?? '').match(/\/veli\/(v1\.\S+)/)?.[1]
  expect(token).toBeTruthy()

  const veliCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  try {
    const veli = await veliCtx.newPage()
    await veli.goto(`/veli/${token}`)
    await expect(veli.getByText(/^Bu sayfa yalnızca bilgi amaçlıdır/)).toBeVisible({ timeout: 20_000 })
    await expect(veli.locator('body')).not.toContainText(NOT)
    await expect(veli.getByRole('heading', { name: 'Öğretmen Notları' })).toHaveCount(0)
  } finally {
    await veliCtx.close()
  }
})
