import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-29: MY ana sayfasında hiçbir öğretmen "Aktif" görünmüyordu — kaynak user_sessions haziranda
 * ölmüştü. Artık usage_daily: son 14 günde uygulamayı kullanan öğretmen Aktif.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/mudur_yardimcisi.json') })

const bugun = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
let schoolId = '', ogr = { id: '', ad: '' }, zb = { id: '', ad: '' }

async function kisi(email: string) {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const id = u.users.find(x => x.email === email)!.id
  const { data: p } = await db.from('profiles').select('full_name, school_id').eq('id', id).single()
  return { id, ad: p!.full_name as string, school_id: p!.school_id as string }
}

test.beforeAll(async () => {
  const o = await kisi(process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example')
  const z = await kisi(process.env.TEST_EMAIL_ZUMRE_BASKANI ?? 'test_zumre_baskani@test.example')
  schoolId = o.school_id
  ogr = { id: o.id, ad: o.ad }
  zb = { id: z.id, ad: z.ad }
  // Test hesapları (@test.example) metriğe yazmaz — kullanım kaydı doğrudan eklenir; zümre başkanına eklenmez
  await db.from('usage_daily').delete().in('user_id', [ogr.id, zb.id])
  const { error } = await db.from('usage_daily').insert({ day: bugun, school_id: schoolId, user_id: ogr.id, role: 'ogretmen', feature: 'odevler', count: 2 })
  if (error) throw error
})

test.afterAll(async () => {
  await db.from('usage_daily').delete().in('user_id', [ogr.id, zb.id])
})

test('MY ana sayfası: kullanan öğretmen Aktif, kullanmayan Pasif; Aktif Öğretmen sayısı doğru', async ({ page }) => {
  await page.goto('/anasayfa')
  const liste = page.locator('section', { has: page.getByRole('heading', { name: 'Öğretmenler' }) })
  const satir = (ad: string) => liste.locator('li', { hasText: ad })
  await expect(satir(ogr.ad)).toContainText('Aktif', { timeout: 20_000 })
  await expect(satir(ogr.ad)).toContainText('son ')
  await expect(satir(zb.ad)).toContainText('Pasif')

  // "Aktif Öğretmen" kartı en az 1 (test okulunda başka öğretmen kullanımı yok → tam 1)
  const kart = page.locator('div.rounded-xl', { has: page.getByText('Aktif Öğretmen', { exact: true }) })
  await expect(kart.locator('p').first()).toHaveText(/^1\/\d+$/)
})

test('Kullanıcılar sayfası: son 30 gün kullanım özeti', async ({ page }) => {
  await page.goto('/kullanicilar')
  const satir = page.locator('tr', { hasText: ogr.ad })
  await expect(satir).toContainText('Son 30 günde 1 gün', { timeout: 20_000 })
  await expect(page.locator('tr', { hasText: zb.ad })).not.toContainText('Son 30 günde')
})
