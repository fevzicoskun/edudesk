import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-26: WhatsApp'tan geç görülen ödev sonradan girilebilmeli — 23'ünde verilip 25'inde
 * teslim edilen ödev 26'sında "23'ünde verildi" olarak kaydedilir. Önceden verildiği gün her zaman
 * kayıt günüydü ve son teslim bugünden önce olamıyordu.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const BASLIK = `E2EGECMIS${Date.now()}`
const istanbulGun = (gunOnce: number) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - gunOnce * 864e5))

test.afterAll(async () => {
  const { data } = await db.from('homeworks').select('id').eq('title', BASLIK)
  const ids = (data ?? []).map(h => h.id)
  if (!ids.length) return
  await db.from('homework_submissions').delete().in('homework_id', ids)
  await db.from('homeworks').delete().in('id', ids)
})

test('geçmişte verilmiş, teslimi geçmiş ödev sonradan girilir', async ({ page }) => {
  const verildigi = istanbulGun(3)
  const sonTeslim = istanbulGun(1)

  await page.goto('/odevler/yeni')
  // Sınıf çipi hidrasyondan önce tıklanırsa tıklama kaybolur → buton aktifleşene dek dene
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })

  await page.locator('input[name="title"]').fill(BASLIK)
  await page.locator('input[name="subject"]').fill('Fizik')
  await page.getByLabel('Verildiği Tarih').fill(verildigi)
  await page.getByLabel('Son Teslim Tarihi').fill(sonTeslim)
  await expect(page.getByText('Geçmiş tarihli ödev — sonradan giriliyor.')).toBeVisible()

  await gonder.click()
  await expect(page).toHaveURL(/\/odevler\/[0-9a-f-]{36}/, { timeout: 30_000 })

  const { data } = await db.from('homeworks').select('assigned_date, due_date, subject').eq('title', BASLIK).single()
  expect(data).toEqual({ assigned_date: verildigi, due_date: sonTeslim, subject: 'Fizik' })
})
