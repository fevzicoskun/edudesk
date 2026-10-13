import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-10-14: Son teslim tarihi hızlı düğmeleri (Yarın/3 gün/1 hafta/10 gün/2 hafta) verildiği
 * günden sayar; telefonda "Ödev Oluştur" düğmesi kaydırmadan görünür (sticky).
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const BASLIK = `E2Ehizli${Date.now()}`
const istanbulGun = (gunOnce: number) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - gunOnce * 864e5))

test.afterAll(async () => {
  const { data } = await db.from('homeworks').select('id').eq('title', BASLIK)
  const ids = (data ?? []).map(h => h.id)
  if (!ids.length) return
  await db.from('homework_submissions').delete().in('homework_id', ids)
  await db.from('homeworks').delete().in('id', ids)
})

test('"1 hafta" düğmesi verildiği günden 7 gün sonrasını yazar; telefonda gönder düğmesi görünür', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const verildigi = istanbulGun(3)
  const beklenen = istanbulGun(-4) // verildiği + 7

  await page.goto('/odevler/yeni')
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await expect.poll(() => page.locator('input[name="title"]').evaluate(el =>
    Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 30_000 }).toBe(true)

  // Sticky: sayfanın en üstündeyken bile gönder düğmesi ekranda
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(gonder).toBeInViewport()

  await page.getByLabel('Verildiği Tarih').fill(verildigi)
  const birHafta = page.getByRole('button', { name: '1 hafta', exact: true })
  await birHafta.click()
  await expect(page.getByLabel('Son Teslim Tarihi')).toHaveValue(beklenen)
  await expect(birHafta).toHaveAttribute('aria-pressed', 'true')

  await page.locator('input[name="title"]').fill(BASLIK)
  await page.locator('input[name="subject"]').fill('Fizik')
  await gonder.click()
  await expect(page).toHaveURL(/\/odevler\/[0-9a-f-]{36}/, { timeout: 30_000 })

  const { data } = await db.from('homeworks').select('assigned_date, due_date').eq('title', BASLIK).single()
  expect(data).toEqual({ assigned_date: verildigi, due_date: beklenen })
})

test('hızlı ekleme penceresinde "1 hafta" bugünden 7 gün sonrası; ödev formunda FAB gizli', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/odevler')
  const fab = page.getByRole('button', { name: 'Hızlı ödev ekle' })
  await expect(async () => {
    await fab.click({ timeout: 2_000 })
    await expect(page.getByRole('group', { name: 'Hızlı teslim tarihi' })).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await page.getByRole('group', { name: 'Hızlı teslim tarihi' }).getByRole('button', { name: '1 hafta', exact: true }).click()
  await expect(page.locator('input[type="date"]').last()).toHaveValue(istanbulGun(-7))

  await page.goto('/odevler/yeni')
  await expect(page.getByRole('heading', { name: 'Ödev Oluştur' })).toBeVisible()
  await expect(fab).toHaveCount(0)
})
