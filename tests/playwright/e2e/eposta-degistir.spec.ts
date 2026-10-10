// 2026-10-10: temsili öğretmen e-postaları gerçeğiyle değişecek — Kullanıcılar'da "E-postayı değiştir"
import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/mudur_yardimcisi.json') })

const ek = Date.now()
const ESKI = `pw_eposta_${ek}@test.example`
const YENI = `pw_eposta_yeni_${ek}@test.example`
const AD = `PW Eposta ${ek}`
let id = ''

test.beforeAll(async () => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const my = u.users.find(x => x.email === (process.env.TEST_EMAIL_MUDUR_YARDIMCISI ?? 'test_mudur_yardimcisi@test.example'))!
  const { data: p } = await db.from('profiles').select('school_id').eq('id', my.id).single()
  const { data, error } = await db.auth.admin.createUser({ email: ESKI, password: `Pw-${ek}-x!`, email_confirm: true })
  if (error) throw error
  id = data.user.id
  const { error: e2 } = await db.rpc('admin_set_profile', { p_id: id, p_full_name: AD, p_subject: 'Fizik', p_role: 'ogretmen', p_school_id: p!.school_id })
  if (e2) throw e2
})

test.afterAll(async () => { if (id) await db.auth.admin.deleteUser(id) })

test('MY öğretmenin e-postasını değiştirir; hesap aynı kalır, hatalı adres reddedilir', async ({ page }) => {
  await page.goto('/kullanicilar')
  const satir = page.locator('tr', { hasText: AD })
  await expect(satir.getByText(ESKI)).toBeVisible({ timeout: 20_000 })

  await satir.getByRole('button', { name: 'E-postayı değiştir' }).click()
  const kutu = satir.getByLabel(`${AD} yeni e-posta`)
  // tarayıcı doğrulamasını kapatıp sunucu doğrulamasını dene (React 19 her render'da input type'ı yeniden yazar → type değiştirmek işe yaramaz)
  await kutu.evaluate(el => { (el as HTMLInputElement).form!.noValidate = true })
  await kutu.fill('gecersiz-adres')
  await satir.getByRole('button', { name: 'Kaydet' }).click()
  await expect(satir.getByRole('alert')).toHaveText('Geçerli bir e-posta girin', { timeout: 15_000 })

  await kutu.fill(`  ${YENI.toUpperCase()} `)
  await satir.getByRole('button', { name: 'Kaydet' }).click()
  await expect(satir.getByText('✓ Güncellendi')).toBeVisible({ timeout: 15_000 })
  await expect(satir.getByText(YENI)).toBeVisible()

  // DB: aynı hesap id'si, yeni e-posta (küçük harf), onaylı
  const { data } = await db.auth.admin.getUserById(id)
  expect(data.user?.email).toBe(YENI)
  expect(data.user?.email_confirmed_at).toBeTruthy()
})
