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

  const eklenenLink = page.getByRole('link', { name: new RegExp(ad) })
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
    await page.getByRole('link', { name: new RegExp(ad) }).click()
    // İlk ziyarette /mentorluk/[studentId] soğuk derlenebilir — geniş zaman aşımı
    await expect(page.getByRole('heading', { name: 'Tanıma kartı' })).toBeVisible({ timeout: 15_000 })

    await listedenCikar(page)
    await expect(page.getByRole('link', { name: new RegExp(ad) })).toHaveCount(0)
  })

  test('detay sayfası: üç bölüm görünür, tanıma kartı kaydedilir, görüşme notu eklenir', async ({ page }) => {
    // Kendi kendine yeten test: kendi öğrencisini ekler, doğrular, sonunda temizler.
    // (Önceki testler kendi öğrencisini geri çıkardığı için burada listenin boş
    // olabileceği varsayılır — bu yüzden `skip` yerine kendi verisini üretir.)
    const ad = await ogrenciEkle(page)
    await page.getByRole('link', { name: new RegExp(ad) }).click()

    // İlk ziyarette /mentorluk/[studentId] soğuk derlenebilir — geniş zaman aşımı
    await expect(page.getByRole('heading', { name: 'Tanıma kartı' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Görüşme notları' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mentörlük düzenimiz' })).toBeVisible()

    // ── Tanıma kartı: düzenle → kaydet → yenile → hâlâ orada mı? ──
    const hedefMetni = `E2E hedef notu ${Date.now()}`
    await page.getByRole('button', { name: 'Düzenle' }).click()

    const hedefAlani = page.getByLabel('Kısa vadeli hedefleri')
    await expect(hedefAlani).toBeVisible()
    await hedefAlani.fill(hedefMetni)

    await page.getByRole('button', { name: 'Kaydet' }).click()
    // Kaydet sonrası form kapanır, salt-okunur görünüme döner
    await expect(page.getByRole('button', { name: 'Düzenle' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(hedefMetni)).toBeVisible()

    // Sunucudan gerçekten kalıcı yazıldığını kanıtla — sayfayı tazele
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Tanıma kartı' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(hedefMetni)).toBeVisible()

    // ── Görüşme notu: ekle → listede görün ──
    const notMetni = `E2E görüşme notu ${Date.now()}`
    const notAlani = page.getByLabel('Görüşme notu')
    await expect(notAlani).toBeVisible()
    await notAlani.fill(notMetni)
    await page.getByRole('button', { name: 'Not ekle' }).click()
    await expect(page.getByText(notMetni)).toBeVisible({ timeout: 10_000 })

    // ── Temizlik ──
    // 1) Notu sil (removeMentorship mentor_reports'u kaskad silmiyor —
    //    UI üzerinden geri alınabilen her şey geri alınır)
    const notlarBolumu = page.locator('section', { hasText: 'Görüşme notları' })
    const silButonu = notlarBolumu.getByRole('button', { name: 'Sil' })
    await expect(silButonu).toBeVisible()
    await silButonu.click() // onay adımına geçer
    const silOnayla = notlarBolumu.getByRole('button', { name: 'Sil' })
    await expect(silOnayla).toBeVisible()
    await silOnayla.click()
    await expect(page.getByText(notMetni)).toHaveCount(0, { timeout: 10_000 })

    // 2) Tanıma kartı alanını boşalt (removeMentorship mentor_profiles'ı da
    //    kaskad silmiyor; en azından içerik bırakmayalım)
    await page.getByRole('button', { name: 'Düzenle' }).click()
    await expect(hedefAlani).toBeVisible()
    await hedefAlani.fill('')
    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByRole('button', { name: 'Düzenle' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(hedefMetni)).toHaveCount(0)

    // 3) Mentörlük kaydını geri çıkar
    await listedenCikar(page)
    await expect(page.getByRole('link', { name: new RegExp(ad) })).toHaveCount(0)
  })
})
