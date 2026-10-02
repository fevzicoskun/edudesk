/**
 * Integration testleri için Supabase yardımcıları.
 * Gerçek service role client kullanır — RLS bypass eder.
 * Her test suite kendi test verisini oluşturur ve temizler.
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Integration testleri için NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.\n' +
    '.env.local dosyasını kontrol edin.'
  )
}

/** Service role client — RLS bypass, tüm işlemlere erişim */
export const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/** Supabase anon key ile istemci — RLS devrede */
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Belirli bir kullanıcının JWT'si ile istemci — gerçek RLS testi için */
export function createUserClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global:  { headers: { Authorization: `Bearer ${accessToken}` } },
      auth:    { autoRefreshToken: false, persistSession: false },
    }
  )
}

// ── Test fixture yardımcıları ────────────────────────────────

export interface TestSchool {
  id: string
  name: string
  slug: string | null
}

export interface TestUser {
  id: string
  email: string
  password: string
  role: string
  schoolId: string
}

/** Test okulu oluştur — schools tablosuna insert */
export async function createTestSchool(nameSuffix = ''): Promise<TestSchool> {
  const uid  = randomUUID().slice(0, 8)
  const name = `__TEST__ Okul ${uid}${nameSuffix}`
  const slug = `test-${uid}`

  const { data, error } = await serviceDb
    .from('schools')
    .insert({ name, slug })
    .select('id, name, slug')
    .single()

  if (error) throw new Error(`createTestSchool hatası: ${error.message}`)
  return data as TestSchool
}

/** Test kullanıcısı oluştur — auth + profiles */
export async function createTestUser(params: {
  role: string
  schoolId: string
  suffix?: string
  /** Varsayılan test.example — increment_usage bu domaini metriğe yazmaz; gerçek kullanıcı yolu için 'example.com' ver */
  emailDomain?: string
}): Promise<TestUser> {
  const uid      = randomUUID().slice(0, 8)
  const email    = `test_${uid}${params.suffix ?? ''}@${params.emailDomain ?? 'test.example'}`
  const password = 'Test1234!'
  const fullName = `Test ${params.role} ${uid}`

  const { data: authData, error: authErr } = await serviceDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr) throw new Error(`createTestUser auth hatası: ${authErr.message}`)

  const { error: profileErr } = await serviceDb.rpc('admin_set_profile', {
    p_id:        authData.user.id,
    p_full_name: fullName,
    p_subject:   'Test',
    p_role:      params.role,
    p_school_id: params.schoolId,
  })
  if (profileErr) throw new Error(`createTestUser profil hatası: ${profileErr.message}`)

  return { id: authData.user.id, email, password, role: params.role, schoolId: params.schoolId }
}

/** Kullanıcı adına giriş yap ve access token döndür */
export async function signInTestUser(email: string, password: string): Promise<string> {
  // service client ile signInWithPassword desteği yok — anon client kullanıyoruz
  const client = createAnonClient()
  // Dosyalar paralel koşar; Supabase auth kısa süreli giriş sınırı aşılınca "rate limit" döner.
  // Yalnız o hatada artan beklemeyle yeniden dene (2+4+8+16+32 sn); başka hata hemen fırlatılır.
  // Tam paket ~33 giriş yapar. Ölçüm (2026-10-02): 2 dk içinde art arda 3 tam koşuda 429 başladı ve
  // bekleme yetmedi; birkaç dakika sonra tek koşu beklemesiz geçti. Art arda koşacaksan ara ver.
  for (let deneme = 0; ; deneme++) {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (!error) return data.session!.access_token
    if (!/rate limit/i.test(error.message) || deneme >= 5) throw new Error(`signInTestUser hatası: ${error.message}`)
    await new Promise(r => setTimeout(r, 2000 * 2 ** deneme))
  }
}

/** Test verilerini temizle (her zaman çağır — test başarılı olsa da olmasa da) */
export async function cleanupTestData(ctx: {
  userIds?:  string[]
  schoolIds?: string[]
  homeworkIds?: string[]
}) {
  // Bağımlı tablolar önce temizlenmeli
  const silinemeyen: string[] = []

  if (ctx.homeworkIds?.length) {
    await serviceDb.from('homework_submissions').delete().in('homework_id', ctx.homeworkIds)
    await serviceDb.from('homeworks').delete().in('id', ctx.homeworkIds)
  }

  if (ctx.schoolIds?.length) {
    // Okul silinince bağımlı tablolar da temizlenmeli (CASCADE yoksa manuel)
    await serviceDb.from('attendance').delete().in('school_id', ctx.schoolIds)
    await serviceDb.from('homeworks').delete().in('school_id', ctx.schoolIds)
    await serviceDb.from('students').delete().in('school_id', ctx.schoolIds)
    await serviceDb.from('classes').delete().in('school_id', ctx.schoolIds)
    await serviceDb.from('audit_logs').delete().in('school_id', ctx.schoolIds)
    await serviceDb.from('user_roles').delete().in('school_id', ctx.schoolIds)
    await serviceDb.from('profiles').delete().in('school_id', ctx.schoolIds)
  }

  if (ctx.userIds?.length) {
    for (const uid of ctx.userIds) {
      const { error } = await serviceDb.auth.admin.deleteUser(uid)
      if (error) silinemeyen.push(`${uid}: ${error.message}`)
    }
  }

  if (ctx.schoolIds?.length) {
    await serviceDb.from('schools').delete().in('id', ctx.schoolIds)
  }

  // Sessiz geçme: silinemeyen kullanıcı canlı auth'ta yetim kalır (2026-10-03'te 224 tane birikmişti)
  if (silinemeyen.length) throw new Error(`cleanupTestData: kullanıcı silinemedi — ${silinemeyen.join('; ')}`)
}
