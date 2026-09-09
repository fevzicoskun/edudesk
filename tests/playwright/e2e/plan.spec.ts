import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')
const MADDE = `PW Plan ${Date.now()}`

test.describe('Haftalık Çalışma Planı', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('sınıf planında madde ekle → durum → Öğrenci 360 → sil', async ({ page }) => {
    await page.goto('/siniflar')
    await page.getByRole('link', { name: /__PW_TEST__ 9-A/ }).first().click()
    await expect(page).toHaveURL(/\/siniflar\/[0-9a-f-]+$/, { timeout: 15_000 })
    const classUrl = page.url()

    await page.getByRole('link', { name: 'Haftalık Plan' }).click()
    await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible({ timeout: 15_000 })

    // İlk öğrenci satırını aç (native <details>)
    const row = page.locator('[data-ogrenci-plan]').first()
    await row.locator('> summary').click()
    const talimat = row.getByLabel('Talimat')
    await expect(talimat).toBeVisible()

    // Hydration yarışı: tıklama sessizce kaybolabilir → toPass deseni
    await expect(async () => {
      await talimat.fill(MADDE)
      await row.getByRole('button', { name: 'Ekle' }).click()
      await expect(row.getByText(MADDE)).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })

    const item = row.locator('li', { hasText: MADDE })
    await item.getByRole('button', { name: 'Yapıldı' }).click()
    await expect(item.getByRole('button', { name: 'Yapıldı' })).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 })
    await expect(row.locator('> summary')).toContainText('1/', { timeout: 10_000 })

    // Öğrenci 360
    const studentId = await row.getAttribute('data-ogrenci-plan')
    await page.goto(`${classUrl}/ogrenciler/${studentId}`)
    const section = page.locator('section', { hasText: 'Haftalık Çalışma Planı' })
    await expect(section.getByText(MADDE)).toBeVisible({ timeout: 15_000 })

    // Temizlik: sil
    await section.locator('li', { hasText: MADDE }).getByRole('button', { name: 'Maddeyi sil' }).click()
    await expect(section.getByText(MADDE)).toHaveCount(0, { timeout: 10_000 })
  })
})
