import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * 2026-10-17: React 19 `<form action>` sunucu hata döndürse de formu sıfırlar — defaultValue'lu
 * alanlar (açıklama, ders) ilk hâline döner, öğretmenin yazdığı kaybolur. Hata sonrası yazılanlar kalmalı.
 * Hata yolu: 2000 karakteri aşan açıklama (sunucu zod'u reddeder, kayıt oluşmaz).
 */
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

const istanbulGun = (gunOnce: number) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - gunOnce * 864e5))

test('yeni ödev: sunucu hatasından sonra açıklama ve ders silinmez', async ({ page }) => {
  await page.goto('/odevler/yeni')
  const gonder = page.locator('button[type="submit"]').last()
  await expect(async () => {
    await page.getByRole('button', { name: /9-A/ }).first().click({ timeout: 2_000 })
    await expect(gonder).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await expect.poll(() => page.locator('input[name="title"]').evaluate(el =>
    Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 30_000 }).toBe(true)

  const ACIKLAMA = 'Uzun açıklama — kaybolmamalı. '.repeat(80) // > 2000 karakter
  await page.locator('input[name="title"]').fill(`E2Ehata${Date.now()}`)
  await page.locator('input[name="subject"]').fill('Kimya')
  const aciklama = page.locator('textarea[name="description"]')
  await expect(aciklama).toHaveAttribute('maxlength', '2000') // önleme katmanı: tarayıcı sınırı
  // Kök neden katmanı: sınır aşılıp sunucu reddetse de (ör. eski sekme) yazılan kalmalı
  await aciklama.evaluate(el => el.removeAttribute('maxlength'))
  await aciklama.fill(ACIKLAMA)
  await page.getByLabel('Son Teslim Tarihi').fill(istanbulGun(-2))

  await gonder.click()
  await expect(page.locator('[data-hw-error]')).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/\/odevler\/yeni/)
  await expect(page.locator('textarea[name="description"]')).toHaveValue(ACIKLAMA)
  await expect(page.locator('input[name="subject"]')).toHaveValue('Kimya')
})
