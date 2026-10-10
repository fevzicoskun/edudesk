// tests/playwright/e2e/veli-bulteni.spec.ts
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Haftalık veli bülteni', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('mentörlükten bültene gidilir; öğrenci mesajı, görsel ve kopyala çalışır', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    // Kendi verisini üretir: bir öğrenciyi mentörlüğe ekler (mentorluk.spec.ts deseni)
    await page.goto('/mentorluk')
    await page.getByRole('button', { name: '+ Öğrenci ekle' }).click()
    const ilk = page.locator('ul button').first()
    await expect(ilk).toBeVisible()
    const ad = (await ilk.locator('span').first().textContent())?.trim() ?? ''
    await ilk.click()
    await expect(page.locator('table').getByRole('link', { name: new RegExp(ad) })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('link', { name: 'Haftalık veli bülteni' }).click()
    await expect(page.getByRole('heading', { name: 'Haftalık veli bülteni' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Veli grubu için' })).toBeVisible()

    const satir = page.locator('details', { hasText: ad })
    await satir.locator('summary').click()
    await expect(satir.locator('pre')).toContainText(`*${ad}*`)
    await expect(satir.locator('pre')).toContainText('Mentör Öğretmeni')
    await satir.getByRole('button', { name: 'Kopyala' }).click()
    await expect(satir.getByRole('button', { name: 'Kopyalandı' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(ad)

    const url = await satir.getByRole('link', { name: 'Görseli indir' }).getAttribute('href')
    const r = await page.request.get(url!)
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toBe('image/png')
    expect(r.headers()['cache-control']).toBe('private, no-store')

    // Kopyala işareti kendiliğinden koyar; işaret sunucuda (bulten_gonderimleri) → yeniden yüklemede kalır
    await expect(satir.getByLabel('Gönderildi')).toBeChecked()
    await expect(satir.getByText('✓ Gönderildi')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.reload()
    await expect(page.locator('details', { hasText: ad }).getByText('✓ Gönderildi')).toBeVisible({ timeout: 15_000 })
    // elle kaldırılabilir ve bu da kalıcıdır
    await page.locator('details', { hasText: ad }).locator('summary').click()
    await page.locator('details', { hasText: ad }).getByLabel('Gönderildi').uncheck()
    await page.waitForLoadState('networkidle')
    await page.reload()
    await expect(page.locator('details', { hasText: ad }).getByText('✓ Gönderildi')).toHaveCount(0, { timeout: 15_000 })

    // Temizlik: öğrenciyi mentörlükten çıkar
    await page.goto('/mentorluk')
    await page.locator('table').getByRole('link', { name: new RegExp(ad) }).click()
    await page.getByRole('button', { name: 'Listeden çıkar' }).click()
    await page.getByRole('button', { name: 'Çıkar' }).click()
    await expect(page).toHaveURL(/\/mentorluk$/, { timeout: 10_000 })
  })

  test('başka öğretmenin öğrencisinin görseli 403', async ({ page }) => {
    const r = await page.request.get('/api/bulten/gorsel?tur=ogrenci&hafta=2026-10-12&ogrenci=00000000-0000-4000-8000-000000000000')
    expect(r.status()).toBe(403)
  })

  test('pazartesi olmayan hafta 400', async ({ page }) => {
    const r = await page.request.get('/api/bulten/gorsel?tur=odevler&hafta=2026-10-13&sinif=00000000-0000-4000-8000-000000000000')
    expect(r.status()).toBe(400)
  })
})

test.describe('Haftalık veli bülteni — bilgisayardan gönderim', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('"WhatsApp\'a gönder (görsel + metin)": kart panoya PNG kopyalanır, wa.me sohbeti metinle açılır', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/mentorluk')
    await page.getByRole('button', { name: '+ Öğrenci ekle' }).click()
    const ilk = page.locator('ul button').first()
    await expect(ilk).toBeVisible()
    const ad = (await ilk.locator('span').first().textContent())?.trim() ?? ''
    await ilk.click()
    await expect(page.locator('table').getByRole('link', { name: new RegExp(ad) })).toBeVisible({ timeout: 10_000 })

    try {
      await page.goto('/mentorluk/bulten')
      const satir = page.locator('details', { hasText: ad })
      await satir.locator('summary').click()
      const gonder = satir.getByRole('button', { name: "WhatsApp'a gönder (görsel + metin)" })
      await expect(gonder).toBeVisible({ timeout: 15_000 }) // yoksa erken düş: finally temizliğine süre kalsın
      const [sekme] = await Promise.all([context.waitForEvent('page', { timeout: 15_000 }), gonder.click()])
      expect(sekme.url()).toMatch(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//)
      expect(decodeURIComponent(sekme.url().replaceAll('+', ' '))).toContain(ad) // wa.me → api.whatsapp.com boşluğu + ile kodlar
      await sekme.close()
      await expect(satir.getByRole('status')).toContainText('Ctrl+V', { timeout: 20_000 })
      const turler = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap(i => [...i.types]))
      expect(turler).toContain('image/png')
    } finally {
      await page.goto('/mentorluk')
      await page.locator('table').getByRole('link', { name: new RegExp(ad) }).click()
      await page.getByRole('button', { name: 'Listeden çıkar' }).click()
      await page.getByRole('button', { name: 'Çıkar' }).click()
      await expect(page).toHaveURL(/\/mentorluk$/, { timeout: 10_000 })
    }
  })
})
