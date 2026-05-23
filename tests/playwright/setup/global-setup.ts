/**
 * Playwright global setup — test kullanıcılarını ve auth state'lerini hazırlar.
 * Her CI/CD çalışmasında bir kez çalışır.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const STORAGE_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

// Auth state dosya yolları — e2e testleri bunları kullanır
export const AUTH_PATHS = {
  ogretmen:         path.join(STORAGE_DIR, 'ogretmen.json'),
  zumre_baskani:    path.join(STORAGE_DIR, 'zumre_baskani.json'),
  mudur_yardimcisi: path.join(STORAGE_DIR, 'mudur_yardimcisi.json'),
  mudur:            path.join(STORAGE_DIR, 'mudur.json'),
} as const

// Test kullanıcı bilgileri (env veya sabit)
// Production'da asla gerçek hesap bilgisi kullanmayın
const TEST_USERS = {
  ogretmen: {
    email:    process.env.TEST_EMAIL_OGRETMEN    ?? 'test_ogretmen@test.example',
    password: process.env.TEST_PASSWORD_OGRETMEN ?? 'Test1234!',
  },
  mudur: {
    email:    process.env.TEST_EMAIL_MUDUR    ?? 'test_mudur@test.example',
    password: process.env.TEST_PASSWORD_MUDUR ?? 'Test1234!',
  },
} as const

export default async function globalSetup() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[playwright] Supabase credentials eksik — auth setup atlanıyor')
    return
  }

  // Auth dizini oluştur
  fs.mkdirSync(STORAGE_DIR, { recursive: true })

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Test kullanıcıları yoksa oluştur
  for (const [role, creds] of Object.entries(TEST_USERS)) {
    try {
      await ensureTestUser(serviceClient, creds.email, creds.password, role as keyof typeof TEST_USERS)
    } catch (e) {
      console.warn(`[playwright] ${role} kullanıcısı hazırlanamadı:`, e)
    }
  }

  // Her kullanıcı için auth state kaydet
  const browser = await chromium.launch()

  for (const [role, creds] of Object.entries(TEST_USERS)) {
    const statePath = AUTH_PATHS[role as keyof typeof AUTH_PATHS]
    if (!statePath) continue

    try {
      const context = await browser.newContext()
      const page    = await context.newPage()

      await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'}/login`)
      await page.fill('input[name="email"]',    creds.email)
      await page.fill('input[name="password"]', creds.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/(anasayfa|dashboard)/, { timeout: 10_000 })

      await context.storageState({ path: statePath })
      await context.close()
      console.log(`[playwright] ${role} auth state kaydedildi`)
    } catch (e) {
      console.warn(`[playwright] ${role} giriş yapılamadı:`, e)
    }
  }

  await browser.close()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTestUser(
  client: SupabaseClient<any>,
  email: string,
  password: string,
  role: string
) {
  // Kullanıcı var mı kontrol et
  const { data: existing } = await client
    .from('profiles')
    .select('id')
    .eq('id',
      (await client.from('profiles').select('id').limit(1)).data?.[0]?.id ?? ''
    )

  // Email'e göre auth user bul
  const { data: { users } } = await client.auth.admin.listUsers()
  const existingUser = users?.find(u => u.email === email)

  if (existingUser) return  // Zaten var

  // Yeni kullanıcı oluştur
  // Test okulu bul veya oluştur
  let schoolId: string
  const { data: schools } = await client
    .from('schools').select('id').ilike('name', '__PW_TEST__%').limit(1)

  if (schools?.length) {
    schoolId = schools[0].id
  } else {
    const { data: newSchool } = await client
      .from('schools')
      .insert({ name: '__PW_TEST__ Okul', code: 'PW_TEST_001' })
      .select('id').single()
    schoolId = newSchool!.id
  }

  const { data: authData } = await client.auth.admin.createUser({
    email, password, email_confirm: true,
  })

  await client.rpc('admin_set_profile', {
    p_id:        authData.user!.id,
    p_full_name: `PW Test ${role}`,
    p_subject:   'Test',
    p_role:      role,
    p_school_id: schoolId,
  })
}
