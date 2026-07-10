import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { AUTH_PATHS } from '../setup/global-setup'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function testSchoolId(): Promise<string> {
  const { data } = await db.from('profiles').select('school_id').ilike('full_name', '%test%').not('school_id', 'is', null).limit(1).single()
  if (!data?.school_id) throw new Error('Test okulu bulunamadı')
  return data.school_id
}

function isoShift(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

test.describe('Abonelik enforcement', () => {
  let schoolId: string

  test.beforeAll(async () => {
    schoolId = await testSchoolId()
    await db.from('schools').update({ access_until: null }).eq('id', schoolId) // kendini onarma
  })

  test.afterAll(async () => {
    await db.from('schools').update({ access_until: null }).eq('id', schoolId)
  })

  test('expiring: müdür bandı görür, öğretmen görmez', async ({ browser }) => {
    await db.from('schools').update({ access_until: isoShift(7) }).eq('id', schoolId)

    const mudurCtx = await browser.newContext({ storageState: AUTH_PATHS.mudur })
    const mudur = await mudurCtx.newPage()
    await mudur.goto('/anasayfa')
    await expect(mudur.getByText(/aboneliği .* sona erecek/i)).toBeVisible()
    await mudurCtx.close()

    const ogrCtx = await browser.newContext({ storageState: AUTH_PATHS.ogretmen })
    const ogr = await ogrCtx.newPage()
    await ogr.goto('/anasayfa')
    await expect(ogr.getByText(/sona erecek/i)).toHaveCount(0)
    await ogrCtx.close()
  })

  test('expired: kullanıcı kilit sayfasına yönlenir', async ({ browser }) => {
    await db.from('schools').update({ access_until: isoShift(-1) }).eq('id', schoolId)

    const ctx = await browser.newContext({ storageState: AUTH_PATHS.ogretmen })
    const page = await ctx.newPage()
    await page.goto('/anasayfa')
    await expect(page).toHaveURL(/abonelik-gerekli/)
    await expect(page.getByText(/abonelik sona erdi/i)).toBeVisible()
    await ctx.close()
  })

  test('null access_until: hiçbir değişiklik yok (geriye uyumluluk)', async ({ browser }) => {
    await db.from('schools').update({ access_until: null }).eq('id', schoolId)

    const ctx = await browser.newContext({ storageState: AUTH_PATHS.ogretmen })
    const page = await ctx.newPage()
    await page.goto('/anasayfa')
    await expect(page).toHaveURL(/anasayfa/)
    await expect(page.getByText(/sona erecek/i)).toHaveCount(0)
    await ctx.close()
  })
})
