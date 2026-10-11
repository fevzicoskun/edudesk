// Yönetici ana sayfası (spec 2026-10-10): MY ve müdür aynı dört bölümü görür, Okul Durumu buraya katıldı
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')
const BOLUMLER = ['Bugün', 'Ödev durumu', 'Öğretmen takibi', 'Mentörlük ve veli']

for (const rol of ['mudur_yardimcisi', 'mudur'] as const) {
  test.describe(`Yönetici ana sayfası — ${rol}`, () => {
    test.use({ storageState: path.join(AUTH_DIR, `${rol}.json`) })

    test('dört bölüm, Okul Durumu araçları ve menüde Okul Durumu yok', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto('/anasayfa')
      for (const b of BOLUMLER) {
        await expect(page.getByRole('region', { name: b, exact: true }), b).toBeVisible({ timeout: 20_000 })
      }
      // Okul Durumu'ndan taşınanlar
      await expect(page.getByRole('button', { name: 'Karne (PDF) indir' })).toBeVisible()
      await expect(page.getByRole('main').getByRole('link', { name: 'Öğrenciler', exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Bugün', exact: true }).getByRole('link', { name: 'Tüm çizelge →' })).toHaveAttribute('href', '/nobet')
      await expect(page.locator('aside').first().getByRole('link', { name: 'Okul Durumu' })).toHaveCount(0)
      // Mentörlük bölümü: bülten haftası ve veli telefonu satırı
      const m = page.getByRole('region', { name: 'Mentörlük ve veli' })
      await expect(m.getByText(/Veli bülteni ·/)).toBeVisible()
      await expect(m.getByText(/Veli telefonu eksik:/)).toBeVisible()
      // Öğretmen takibi tablo başlıkları
      const t = page.getByRole('region', { name: 'Öğretmen takibi' })
      for (const s of ['Öğretmen', 'Ödev', 'Kontrol', 'Bekleyen', 'Son giriş']) {
        await expect(t.getByRole('columnheader', { name: s, exact: true })).toBeVisible()
      }
    })

    test('menüden idare mentörlük listesi açılır (notlar yok)', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto('/anasayfa')
      await page.locator('aside').first().getByRole('link', { name: 'Mentörlük', exact: true }).click()
      await expect(page).toHaveURL(/\/yonetim\/mentorluk$/, { timeout: 20_000 })
      await expect(page.getByRole('heading', { name: 'Mentörlük', level: 1 })).toBeVisible()
      await expect(page.getByText(/öğrenciden \d+'inin mentörü var/)).toBeVisible()
      await expect(page.getByText('Görüşme notları yalnız mentöre görünür', { exact: false })).toBeVisible()
    })

    test('aylık rapor PDF iner (kurucuya tek sayfa)', async ({ page }, info) => {
      await page.goto('/anasayfa')
      const dugme = page.getByRole('button', { name: /raporu \(PDF\)$/ })
      await expect(dugme).toBeVisible({ timeout: 20_000 })
      const [indirme] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), dugme.click()])
      expect(indirme.suggestedFilename()).toMatch(/^aylik-rapor-\d{4}-\d{2}\.pdf$/)
      await indirme.saveAs(info.outputPath(indirme.suggestedFilename()))
    })
  })
}
