import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Mentörlük', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('mentörlük sayfası açılır ve boş durum görünür', async ({ page }) => {
    await page.goto('/mentorluk')
    await expect(page.getByRole('heading', { name: 'Mentörlüğüm' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Öğrenci ekle' })).toBeVisible()
  })

  test('öğrenci eklenir, listede görünür ve temizlik için geri çıkarılır', async ({ page }) => {
    await page.goto('/mentorluk')
    await expect(page.getByRole('button', { name: '+ Öğrenci ekle' })).toBeVisible()
    await page.getByRole('button', { name: '+ Öğrenci ekle' }).click()

    const arama = page.getByLabel('Öğrenci ara')
    await expect(arama).toBeVisible()

    // İlk öneriyi seç
    const ilkOneri = page.locator('ul button').first()
    await expect(ilkOneri).toBeVisible()
    const ad = (await ilkOneri.locator('span').first().textContent())?.trim() ?? ''
    await ilkOneri.click()

    // Liste yenilenince öğrenci görünür
    const eklenenLink = page.getByRole('link', { name: new RegExp(ad) })
    await expect(eklenenLink).toBeVisible({ timeout: 10_000 })

    // Temizlik: eklenen öğrenciyi detay sayfasından geri çıkar (canlı veriye artık kalmasın)
    await eklenenLink.click()
    await expect(page.getByRole('heading', { name: 'Tanıma kartı' })).toBeVisible()

    const cikarButonu = page.getByRole('button', { name: 'Listeden çıkar' })
    await expect(cikarButonu).toBeVisible()
    await cikarButonu.click()

    const onayla = page.getByRole('button', { name: 'Çıkar' })
    await expect(onayla).toBeVisible()
    await onayla.click()

    await expect(page).toHaveURL(/\/mentorluk$/, { timeout: 10_000 })
    await expect(page.getByRole('link', { name: new RegExp(ad) })).toHaveCount(0)
  })

  test('detay sayfasında üç bölüm de görünür', async ({ page }) => {
    await page.goto('/mentorluk')
    const ilkOgrenci = page.locator('ul li a').first()
    if (await ilkOgrenci.count() === 0) test.skip()
    await ilkOgrenci.click()

    await expect(page.getByRole('heading', { name: 'Tanıma kartı' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Görüşme notları' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mentörlük düzenimiz' })).toBeVisible()
  })
})
