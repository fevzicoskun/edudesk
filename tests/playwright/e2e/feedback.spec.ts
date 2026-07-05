import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Geri bildirim + kullanım beacon\'ı', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('anasayfa ziyareti usage beacon\'ı atar', async ({ page }) => {
    // Not: sendBeacon istekleri Playwright'ta yakalanır ama postDataJSON() Blob
    // gövdesini çözemiyor (her zaman null) — bu yüzden brief'in fallback'i
    // kullanıldı: durum kodu bazlı doğrulama (204 = beacon endpoint'i kabul etti).
    const beacon = page.waitForResponse(
      res => res.url().includes('/api/usage') && res.status() === 204,
      { timeout: 15_000 }
    )
    await page.goto('/anasayfa')
    await beacon
  })

  test('feedback formu gönderilir ve teşekkür mesajı görünür', async ({ page }) => {
    await page.goto('/anasayfa')
    await page.getByRole('button', { name: 'Öneri & Destek' }).click()
    await page.getByPlaceholder('Mesajınızı buraya yazın…').fill('E2E test geri bildirimi — otomatik')
    await page.getByRole('button', { name: 'Gönder' }).click()
    await expect(page.getByText('Mesajın iletildi, teşekkürler!')).toBeVisible({ timeout: 10_000 })
  })
})
