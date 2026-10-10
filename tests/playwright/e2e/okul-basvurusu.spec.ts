// 2026-10-10: okul başvurusu yalnız mail atıyordu; bildirim adresi bounce verince başvurular kayboldu.
// Artık önce okul_basvurulari tablosuna yazılır (/platform'da listelenir).
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

test('başvuru formu veritabanına kaydeder (mail olmasa da kaybolmaz)', async ({ page }) => {
  const okul = `PW Başvuru Okulu ${Date.now()}`
  try {
    await page.goto('/kayit')
    await page.locator('input[name="school_name"]').fill(okul)
    await page.locator('input[name="contact_name"]').fill('PW Yetkili')
    await page.locator('input[name="email"]').fill('pw_basvuru@test.example')
    await page.locator('input[name="phone"]').fill('05551112233')
    await page.locator('[name="note"]').fill('otomatik test')
    await page.locator('input[name="kvkk"]').check()
    await page.getByRole('button', { name: 'Başvuruyu Gönder' }).click()
    await expect(page.getByRole('heading', { name: 'Başvurunuz alındı!' })).toBeVisible({ timeout: 20_000 })

    const { data } = await db.from('okul_basvurulari').select('contact_name, email, phone, durum').eq('school_name', okul)
    expect(data).toEqual([{ contact_name: 'PW Yetkili', email: 'pw_basvuru@test.example', phone: '05551112233', durum: 'yeni' }])
  } finally {
    await db.from('okul_basvurulari').delete().eq('school_name', okul)
  }
})
