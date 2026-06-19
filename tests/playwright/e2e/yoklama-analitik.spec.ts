import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Yoklama Analitik — Öğretmen', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('/yoklama/analitik yüklenir ve başlık görünür', async ({ page }) => {
    await page.goto('/yoklama/analitik')
    await expect(page).not.toHaveURL(/login/, { timeout: 8_000 })
    await expect(page.getByRole('heading', { name: 'Yoklama Analitiği', level: 1 })).toBeVisible({ timeout: 10_000 })
  })

  test('KPI özet kartları render edilir', async ({ page }) => {
    await page.goto('/yoklama/analitik')
    await expect(page.getByText('Toplam özürsüz devamsızlık')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Bugün yoklama alınan sınıf')).toBeVisible()
  })

  test('Sınıf karşılaştırma, trend ve kronik sicil bölümleri görünür', async ({ page }) => {
    await page.goto('/yoklama/analitik')
    await expect(page.getByRole('heading', { name: 'Sınıf Karşılaştırma' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /Haftalık Devamsızlık Trendi/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Kronik Devamsızlar/ })).toBeVisible()
  })

  test('Kapsama bölümü öğretmene gösterilmez (müdür+ özel)', async ({ page }) => {
    await page.goto('/yoklama/analitik')
    // Önce sayfanın render olduğundan emin ol, sonra kapsama bölümünün YOK olduğunu doğrula
    await expect(page.getByRole('heading', { name: 'Yoklama Analitiği', level: 1 })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /Sınıf Yoklama Kapsaması/ })).toHaveCount(0)
  })

  test('/yoklama sayfasından "Analitik" linki ile geçiş çalışır', async ({ page }) => {
    await page.goto('/yoklama')
    await expect(page).not.toHaveURL(/login/)
    await page.getByRole('link', { name: /Analitik/ }).click()
    await page.waitForURL(url => url.pathname === '/yoklama/analitik', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Yoklama Analitiği', level: 1 })).toBeVisible()
  })
})

test.describe('Yoklama Analitik — Müdür', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur.json') })

  test('Sınıf yoklama kapsaması bölümü müdüre gösterilir', async ({ page }) => {
    await page.goto('/yoklama/analitik')
    await expect(page.getByRole('heading', { name: 'Yoklama Analitiği', level: 1 })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /Sınıf Yoklama Kapsaması/ })).toBeVisible({ timeout: 10_000 })
  })
})
