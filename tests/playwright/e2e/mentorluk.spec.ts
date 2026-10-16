import { test, expect, type Page } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

/** "+ Öğrenci ekle" kutusunu açar, ilk öneriyi seçer, listede göründüğünü
 *  doğrular ve eklenen öğrencinin adını döner. */
async function ogrenciEkle(page: Page): Promise<string> {
  await page.goto('/mentorluk')
  await expect(page.getByRole('button', { name: '+ Öğrenci ekle' })).toBeVisible()
  await page.getByRole('button', { name: '+ Öğrenci ekle' }).click()

  const arama = page.getByLabel('Öğrenci ara')
  await expect(arama).toBeVisible()

  const ilkOneri = page.locator('ul button').first()
  await expect(ilkOneri).toBeVisible()
  const ad = (await ilkOneri.locator('span').first().textContent())?.trim() ?? ''
  await ilkOneri.click()

  const eklenenLink = page.locator('table').getByRole('link', { name: new RegExp(ad) })
  await expect(eklenenLink).toBeVisible({ timeout: 10_000 })
  return ad
}

/** Detay sayfasındayken "Listeden çıkar" → onay "Çıkar" ile temizler. */
async function listedenCikar(page: Page) {
  const cikarButonu = page.getByRole('button', { name: 'Listeden çıkar' })
  await expect(cikarButonu).toBeVisible()
  await cikarButonu.click()

  const onayla = page.getByRole('button', { name: 'Çıkar' })
  await expect(onayla).toBeVisible()
  await onayla.click()

  await expect(page).toHaveURL(/\/mentorluk$/, { timeout: 10_000 })
}

test.describe('Mentörlük', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('mentörlük sayfası açılır ve boş durum görünür', async ({ page }) => {
    await page.goto('/mentorluk')
    await expect(page.getByRole('heading', { name: 'Mentörlüğüm' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Öğrenci ekle' })).toBeVisible()
  })

  test('öğrenci eklenir, listede görünür ve temizlik için geri çıkarılır', async ({ page }) => {
    const ad = await ogrenciEkle(page)

    // Temizlik: eklenen öğrenciyi detay sayfasından geri çıkar (canlı veriye artık kalmasın)
    await page.locator('table').getByRole('link', { name: new RegExp(ad) }).click()
    // İlk ziyarette /mentorluk/[studentId] soğuk derlenebilir — geniş zaman aşımı
    await expect(page.getByRole('heading', { name: 'Ödev durumu' })).toBeVisible({ timeout: 15_000 })

    await listedenCikar(page)
    await expect(page.locator('table').getByRole('link', { name: new RegExp(ad) })).toHaveCount(0)
  })

  test('detay sayfası: ödev durumu görünür; tanıma kartı, mentörlük düzeni, görüşme notu yok (2026-10-17 kaldırıldı)', async ({ page }) => {
    const ad = await ogrenciEkle(page)
    await page.locator('table').getByRole('link', { name: new RegExp(ad) }).click()
    // İlk ziyarette /mentorluk/[studentId] soğuk derlenebilir — geniş zaman aşımı
    await expect(page.getByRole('heading', { name: 'Ödev durumu' })).toBeVisible({ timeout: 15_000 })
    for (const yok of ['Tanıma kartı', 'Mentörlük düzenimiz', 'Görüşme notları']) {
      await expect(page.getByRole('heading', { name: yok })).toHaveCount(0)
    }
    await listedenCikar(page)
    await expect(page.locator('table').getByRole('link', { name: new RegExp(ad) })).toHaveCount(0)
  })
})
