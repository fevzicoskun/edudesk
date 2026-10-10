import { test, expect } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// 2026-10-10 kullanıcı: yazdırırken kenar boşluğu çok az — rapor sayfaları print:p-0, @page margin yoktu (yazı 0 mm'de)
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const mm = (pt: number) => (pt * 25.4) / 72

test.use({ storageState: path.join(process.cwd(), 'tests/playwright/.auth/ogretmen.json') })

test('yazdırılan raporda yazı kâğıt kenarından en az 10 mm içeride', async ({ page }) => {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 })
  const id = u.users.find(x => x.email === (process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'))!.id
  const { data: p } = await db.from('profiles').select('school_id').eq('id', id).single()
  const { data: st } = await db.from('students').select('class_id').eq('school_id', p!.school_id).is('deleted_at', null).limit(1).single()

  await page.goto(`/siniflar/${st!.class_id}/odev-raporu`)
  await expect(page.getByRole('heading', { name: 'Tüm Öğrencilerin Ödev Özetleri' })).toBeVisible({ timeout: 20_000 })
  await page.emulateMedia({ media: 'print' })
  // preferCSSPageSize: kenarı yalnız @page belirler ("Kenar boşlukları: Yok" seçen kullanıcı gibi)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await page.pdf({ format: 'A4', preferCSSPageSize: true })) }).promise
  const sayfa = await pdf.getPage(1)
  const [, , W, H] = sayfa.view
  const yazilar = (await sayfa.getTextContent()).items.filter(i => 'str' in i && i.str.trim()) as { transform: number[]; width: number }[]
  expect(mm(Math.min(...yazilar.map(i => i.transform[4])))).toBeGreaterThanOrEqual(10)
  expect(mm(W - Math.max(...yazilar.map(i => i.transform[4] + i.width)))).toBeGreaterThanOrEqual(10)
  expect(mm(H - Math.max(...yazilar.map(i => i.transform[5])))).toBeGreaterThanOrEqual(10)
})
