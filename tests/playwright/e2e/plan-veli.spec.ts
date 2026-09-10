import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')
const MADDE = `PW Veli Plan ${Date.now()}`

test.describe('Haftalık Çalışma Planı — veli portalı', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json'), permissions: ['clipboard-read', 'clipboard-write'] })

  test('öğretmen madde ekler → veli linkinde "Haftalık Çalışma Planı / Bu Hafta" görünür', async ({ page, browser }) => {
    await page.goto('/siniflar')
    await page.getByRole('link', { name: /__PW_TEST__ 9-A/ }).first().click()
    await expect(page).toHaveURL(/\/siniflar\/[0-9a-f-]+$/, { timeout: 15_000 })
    const classUrl = page.url()

    await page.getByRole('link', { name: 'Haftalık Plan' }).click()
    await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible({ timeout: 15_000 })

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

    // Öğrenci 360 → veli linki oluştur (URL "…/veli/v1.…" olarak listelenir)
    const studentId = await row.getAttribute('data-ogrenci-plan')
    await page.goto(`${classUrl}/ogrenciler/${studentId}`)
    const linkText = page.getByText(/…\/veli\/v1\./)
    await expect(async () => {
      await page.getByRole('button', { name: /Veli Linkini Oluştur|Yeni Link Oluştur/ }).click()
      await expect(linkText).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
    const token = ((await linkText.textContent()) ?? '').match(/\/veli\/(v1\.\S+)/)?.[1]
    expect(token).toBeTruthy()

    // Veli: oturumsuz bağlam
    const veliCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    try {
      const veli = await veliCtx.newPage()
      await veli.goto(`/veli/${token}`)
      const section = veli.getByRole('region', { name: 'Haftalık Çalışma Planı' })
      await expect(section).toBeVisible({ timeout: 15_000 })
      await expect(section.getByRole('heading', { name: 'Bu Hafta' })).toBeVisible()
      const item = section.locator('li', { hasText: MADDE })
      await expect(item).toBeVisible()
      await expect(item).toContainText('Planlandı')
    } finally {
      await veliCtx.close()
    }

    // Temizlik: maddeyi sil
    const plan360 = page.locator('section', { hasText: 'Haftalık Çalışma Planı' })
    await plan360.locator('li', { hasText: MADDE }).getByRole('button', { name: 'Maddeyi sil' }).click()
    await expect(plan360.getByText(MADDE)).toHaveCount(0, { timeout: 10_000 })
  })
})
