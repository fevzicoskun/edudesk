import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

/**
 * 2026-09-25: ödev kontrol ekranında öğrenci notu — "sürekli kaydedildi" şikâyeti.
 * Kök neden: not her odak kaybında (metin değişmese de) kaydediliyor ve "✓ kaydedildi" gösteriyordu.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

let hwId = ''

test.beforeAll(async () => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ogretmenId = data.users.find(u => u.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', ogretmenId).single()
  const { data: st } = await db.from('students').select('class_id')
    .eq('school_id', p!.school_id).is('deleted_at', null).limit(1).single()
  const { data: hw, error } = await db.from('homeworks').insert({
    teacher_id: ogretmenId, title: `E2ENOT${Date.now()}`, school_id: p!.school_id,
    class_id: st!.class_id, subject: 'Test', is_template: false,
  }).select('id').single()
  if (error) throw error
  hwId = hw!.id
})

test.afterAll(async () => {
  if (!hwId) return
  await db.from('homework_submissions').delete().eq('homework_id', hwId)
  await db.from('homeworks').delete().eq('id', hwId)
})

/** Bu ödev için giden not-kaydetme isteklerini sayar (server action gövdesinde ödev id'si geçer) */
function notIstekleri(page: Page) {
  const sayac = { n: 0 }
  page.on('request', r => {
    if (r.method() === 'POST' && r.headers()['next-action'] && (r.postData() ?? '').includes(hwId)) sayac.n++
  })
  return sayac
}

async function notuAc(page: Page, ad: RegExp) {
  const alan = page.getByRole('textbox', { name: /için not$/ })
  await expect(async () => {
    await page.getByRole('button', { name: ad }).first().click()
    await expect(alan).toBeVisible({ timeout: 1000 })
  }).toPass()
  return alan
}

test.describe.configure({ mode: 'serial' })

test('not açılınca odak alana gelir, yazılan metin eksiksiz ve bir kez kaydedilir', async ({ page }) => {
  const istek = notIstekleri(page)
  await page.goto(`/odevler/${hwId}`)
  const alan = await notuAc(page, /için not ekle$/)
  await expect(alan).toBeFocused()

  const metin = 'Kitabını getirmedi, yarın kontrol edilecek'
  await alan.pressSequentially(metin, { delay: 40 })
  await expect(alan).toBeFocused()
  expect(istek.n).toBe(0) // yazarken kayıt yok

  await page.getByRole('heading', { name: /^E2ENOT/ }).click()
  await expect.poll(async () => {
    const { data } = await db.from('homework_submissions').select('note').eq('homework_id', hwId).not('note', 'is', null)
    return data?.map(r => r.note)
  }).toEqual([metin])
  expect(istek.n).toBe(1)
})

test('değişmeyen not odaktan çıkınca yeniden kaydedilmez, "kaydedildi" görünmez', async ({ page }) => {
  await page.goto(`/odevler/${hwId}`)
  const istek = notIstekleri(page)
  const alan = await notuAc(page, /notunu düzenle$/)
  await expect(alan).toHaveValue('Kitabını getirmedi, yarın kontrol edilecek')

  await page.getByRole('heading', { name: /^E2ENOT/ }).click()
  await alan.click()
  await page.getByRole('heading', { name: /^E2ENOT/ }).click()
  await page.waitForTimeout(1500)
  expect(istek.n).toBe(0)
  await expect(page.getByText('✓ kaydedildi')).toHaveCount(0)
})

test('telefonda başka uygulamaya geçince (sayfa gizlenince) yazılan not odak kaybı olmadan kaydedilir', async ({ page }) => {
  await page.goto(`/odevler/${hwId}`)
  const alan = await notuAc(page, /notunu düzenle$/)
  const metin = 'Arka plana geçmeden önce yazıldı'
  await alan.fill(metin)
  await expect(alan).toBeFocused()
  // blur yok — yalnız sayfa gizleniyor (uygulama değişimi / ekran kilidi)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(async () => {
    const { data } = await db.from('homework_submissions').select('note').eq('homework_id', hwId).not('note', 'is', null)
    return data?.map(r => r.note)
  }).toEqual([metin])
})
