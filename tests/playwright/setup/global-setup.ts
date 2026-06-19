import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const STORAGE_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

export const AUTH_PATHS = {
  ogretmen:         path.join(STORAGE_DIR, 'ogretmen.json'),
  zumre_baskani:    path.join(STORAGE_DIR, 'zumre_baskani.json'),
  mudur_yardimcisi: path.join(STORAGE_DIR, 'mudur_yardimcisi.json'),
  mudur:            path.join(STORAGE_DIR, 'mudur.json'),
} as const

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

  fs.mkdirSync(STORAGE_DIR, { recursive: true })

  // Webpack dev mode on-demand derleme yapıyor — ilk sayfa isteğinde 20-30s gecikme olabilir.
  // Auth setup'tan ÖNCE kritik sayfaları ziyaret ederek derlemeyi tetikliyoruz.
  await warmupDevServer(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000')

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Test okulu bir kez bul/oluştur; her iki kullanıcı aynı okulu paylaşır
  const schoolId = await ensureTestSchool(serviceClient)

  let ogretmenId: string | null = null
  for (const [role, creds] of Object.entries(TEST_USERS)) {
    try {
      const userId = await upsertTestUser(serviceClient, creds.email, creds.password, role as keyof typeof TEST_USERS, schoolId)
      if (role === 'ogretmen') ogretmenId = userId
      console.log(`[playwright] ${role} hazır (schoolId: ${schoolId})`)
    } catch (e) {
      console.error(`[playwright] ${role} kullanıcısı hazırlanamadı:`, e)
    }
  }

  // E2E fixture: öğretmene atanmış sınıf + öğrenci. Olmadan dashboard "bekleme ekranı",
  // çizelge/yoklama boş-durum gösterir; dolu-UI testleri (SummaryCard/Risk/toggle/grid) başarısız olur.
  if (ogretmenId) {
    try {
      await seedTeacherClassData(serviceClient, schoolId, ogretmenId)
      console.log('[playwright] öğretmen sınıf + öğrenci seed edildi')
    } catch (e) {
      console.error('[playwright] sınıf/öğrenci seed edilemedi:', e)
    }
  }

  const browser = await chromium.launch()
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

  for (const [role, creds] of Object.entries(TEST_USERS)) {
    const statePath = AUTH_PATHS[role as keyof typeof AUTH_PATHS]
    if (!statePath) continue

    try {
      const context = await browser.newContext()
      const page    = await context.newPage()

      await page.goto(`${BASE_URL}/login`)
      await page.fill('#email',    creds.email)
      await page.fill('#password', creds.password)
      await page.click('button[type="submit"]')

      // Auth cookie'ler login action'da set edilir; /login'den herhangi bir yere geçmesi yeterli
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30_000 })

      // Warmup /anasayfa'yı compile etmiş olmalı; direkt goto ile doğrula
      await page.goto(`${BASE_URL}/anasayfa`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

      const finalUrl = page.url()
      if (finalUrl.includes('onboarding')) {
        console.error(`[playwright] ${role} onboarding'e düştü — profil eksik! URL: ${finalUrl}`)
      }

      await context.storageState({ path: statePath })
      await context.close()
      console.log(`[playwright] ${role} auth state kaydedildi (${finalUrl})`)
    } catch (e) {
      console.error(`[playwright] ${role} giriş yapılamadı:`, e)
    }
  }

  await browser.close()
}

async function warmupDevServer(baseUrl: string) {
  // On-demand derleme tetikleyici: login yap, sonra /anasayfa'ya direkt git.
  // waitForURL ile middleware redirect zinciri beklenmez — goto() zinciri keser.
  const warmupBrowser = await chromium.launch()
  try {
    const ctx  = await warmupBrowser.newContext()
    const page = await ctx.newPage()

    const email    = process.env.TEST_EMAIL_OGRETMEN    ?? 'test_ogretmen@test.example'
    const password = process.env.TEST_PASSWORD_OGRETMEN ?? 'Test1234!'

    console.log('[playwright] warmup — /login yükleniyor...')
    await page.goto(`${baseUrl}/login`, { timeout: 30_000 })
    await page.fill('#email',    email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Login action'ın tamamlanmasını bekle — /login'den herhangi bir yere geçmesi yeterli
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30_000 })

    // Auth cookies set edildi; şimdi /anasayfa'yı doğrudan compile ettir
    console.log('[playwright] warmup — /anasayfa derleniyor...')
    await page.goto(`${baseUrl}/anasayfa`, {
      waitUntil: 'domcontentloaded',
      timeout:   120_000,
    })
    console.log(`[playwright] warmup tamamlandı — URL: ${page.url()}`)
    await ctx.close()
  } catch (e) {
    console.warn('[playwright] warmup başarısız (devam ediliyor):', e)
  } finally {
    await warmupBrowser.close()
  }
}

async function ensureTestSchool(client: SupabaseClient): Promise<string> {
  const { data: schools } = await client
    .from('schools').select('id, slug').ilike('name', '__PW_TEST__%').limit(1)

  if (schools?.length) {
    const school = schools[0]
    // Slug yoksa layout.tsx slug kontrolünü geçmek için set et
    if (!school.slug) {
      await client.from('schools').update({ slug: 'TEST001' }).eq('id', school.id)
    }
    return school.id
  }

  const { data: newSchool, error } = await client
    .from('schools')
    .insert({ name: '__PW_TEST__ Okul', slug: 'TEST001' })
    .select('id').single()
  if (error || !newSchool) throw new Error(`Test okulu oluşturulamadı: ${error?.message}`)
  return newSchool.id
}

async function upsertTestUser(
  client: SupabaseClient,
  email: string,
  password: string,
  role: keyof typeof TEST_USERS,
  schoolId: string
): Promise<string> {
  const { data: { users } } = await client.auth.admin.listUsers({ perPage: 1000 })
  const existing = users?.find(u => u.email === email)

  let userId: string
  if (existing) {
    userId = existing.id
    // Şifre + JWT metadata güncelle — proxy.ts school_id'yi user_metadata'dan okursa DB sorgusu atlar
    const { error: pwErr } = await client.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { school_id: schoolId, role },
    })
    if (pwErr) throw new Error(`Kullanıcı güncellenemedi: ${pwErr.message}`)
  } else {
    const { data: authData, error } = await client.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { school_id: schoolId, role },
    })
    if (error || !authData.user) throw new Error(`Auth user oluşturulamadı: ${error?.message}`)
    userId = authData.user.id
  }

  // Profili upsert et (school_id garantili)
  const { error: profileErr } = await client.rpc('admin_set_profile', {
    p_id:        userId,
    p_full_name: `PW Test ${role}`,
    p_subject:   'Test',
    p_role:      role,
    p_school_id: schoolId,
  })
  if (profileErr) throw new Error(`Profil oluşturulamadı: ${profileErr.message}`)

  // Doğrulama — profil DB'de doğru kaydedildi mi?
  const { data: verif } = await client
    .from('profiles').select('school_id, role').eq('id', userId).single()
  if (!verif?.school_id) {
    throw new Error(`Profil doğrulaması başarısız — school_id yok (${role})`)
  }
  return userId
}

// getEgitimYili() ile aynı mantık (src import'una bağımlı kalmamak için inline).
function currentEgitimYili(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

async function seedTeacherClassData(client: SupabaseClient, schoolId: string, teacherId: string) {
  const CLASS_NAME = '__PW_TEST__ 9-A'

  // Sınıf (idempotent: ad + okul ile bul)
  let classId: string
  const { data: existing } = await client
    .from('classes').select('id').eq('school_id', schoolId).eq('name', CLASS_NAME).is('deleted_at', null).limit(1)
  if (existing?.length) {
    classId = existing[0].id
  } else {
    const { data: cls, error } = await client
      .from('classes')
      .insert({ name: CLASS_NAME, grade: 9, academic_year: currentEgitimYili(), school_id: schoolId })
      .select('id').single()
    if (error || !cls) throw new Error(`Test sınıfı oluşturulamadı: ${error?.message}`)
    classId = cls.id
  }

  // teacher_classes ataması (dashboard bekleme ekranı kapısı + çizelge grid)
  const { error: tcErr } = await client
    .from('teacher_classes')
    .upsert({ teacher_id: teacherId, class_id: classId }, { ignoreDuplicates: true })
  if (tcErr) throw new Error(`teacher_classes ataması yapılamadı: ${tcErr.message}`)

  // Öğrenciler (yoklama toggle'ı için en az 1 gerekli; idempotent: ad ile)
  const wanted = [
    { full_name: 'PW Test Öğrenci 1', student_number: '101' },
    { full_name: 'PW Test Öğrenci 2', student_number: '102' },
  ]
  const { data: have } = await client
    .from('students').select('full_name').eq('class_id', classId).is('deleted_at', null)
  const haveNames = new Set((have ?? []).map(s => s.full_name))
  const toInsert = wanted
    .filter(s => !haveNames.has(s.full_name))
    .map(s => ({ ...s, class_id: classId, school_id: schoolId }))
  if (toInsert.length) {
    const { error: stuErr } = await client.from('students').insert(toInsert)
    if (stuErr) throw new Error(`Test öğrencileri oluşturulamadı: ${stuErr.message}`)
  }
}
