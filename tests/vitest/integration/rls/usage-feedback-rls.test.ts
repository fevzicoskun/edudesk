/**
 * usage_daily + feedback RLS testleri.
 * DİKKAT: Bu tablolarda SELECT policy yok — assertInsertAllowed (insert().select())
 * KULLANILAMAZ; yazımlar RPC ile, doğrulama serviceDb ile yapılır.
 *
 * Sertleştirme (20260705170000): feedback'e doğrudan INSERT tamamen kapalı
 * (policy yok); yazım yalnız submit_feedback RPC'sinden. increment_usage
 * feature whitelist'i uygular.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb,
  createUserClient,
  createTestSchool,
  createTestUser,
  signInTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'
import { assertInsertBlocked } from './rls-assert'

let school:   TestSchool
let school2:  TestSchool
let ogretmen: TestUser
let token:    string

beforeAll(async () => {
  school  = await createTestSchool('_USAGE')
  school2 = await createTestSchool('_USAGE2')
  ogretmen = await createTestUser({ role: 'ogretmen', schoolId: school.id })
  token = await signInTestUser(ogretmen.email, ogretmen.password)
})

afterAll(async () => {
  await serviceDb.from('usage_daily').delete().eq('school_id', school.id)
  await serviceDb.from('feedback').delete().eq('school_id', school.id)
  await cleanupTestData({
    userIds: [ogretmen.id],
    schoolIds: [school.id, school2.id],
  })
})

describe('increment_usage RPC', () => {
  it('aynı gün iki çağrıda count=2 olur', async () => {
    const client = createUserClient(token)
    const { error: e1 } = await client.rpc('increment_usage', { p_feature: 'yoklama' })
    expect(e1).toBeNull()
    const { error: e2 } = await client.rpc('increment_usage', { p_feature: 'yoklama' })
    expect(e2).toBeNull()

    const { data } = await serviceDb
      .from('usage_daily')
      .select('count, role, school_id')
      .eq('user_id', ogretmen.id)
      .eq('feature', 'yoklama')
      .single()
    expect(data?.count).toBe(2)
    expect(data?.role).toBe('ogretmen')
    expect(data?.school_id).toBe(school.id)
  })

  it('farklı feature ayrı satır açar', async () => {
    const client = createUserClient(token)
    await client.rpc('increment_usage', { p_feature: 'odevler' })
    const { data } = await serviceDb
      .from('usage_daily')
      .select('feature')
      .eq('user_id', ogretmen.id)
    expect(data?.map(r => r.feature).sort()).toEqual(['odevler', 'yoklama'])
  })

  it('whitelist dışı feature sessizce yazılmaz', async () => {
    const client = createUserClient(token)
    const { error } = await client.rpc('increment_usage', { p_feature: 'sahte-metrik' })
    expect(error).toBeNull() // sessiz no-op, hata üretmez

    const { data } = await serviceDb
      .from('usage_daily')
      .select('feature')
      .eq('user_id', ogretmen.id)
      .eq('feature', 'sahte-metrik')
    expect(data ?? []).toHaveLength(0)
  })

  it('usage_daily tablosuna doğrudan INSERT engellenir', async () => {
    const client = createUserClient(token)
    await assertInsertBlocked(client, 'usage_daily', {
      day: '2026-07-05', school_id: school.id, user_id: ogretmen.id,
      role: 'ogretmen', feature: 'hack',
    })
  })

  it('usage_daily doğrudan okunamaz (0 satır)', async () => {
    const client = createUserClient(token)
    const { data, error } = await client.from('usage_daily').select('*')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})

describe('feedback yazımı (submit_feedback RPC)', () => {
  it('doğrudan INSERT tamamen engellenir — kendi adına bile (policy yok)', async () => {
    const client = createUserClient(token)
    await assertInsertBlocked(client, 'feedback', {
      school_id: school.id, user_id: ogretmen.id, role: 'ogretmen',
      page_path: '/yoklama', category: 'oneri', message: 'doğrudan insert denemesi',
    })
  })

  it('role spoof doğrudan INSERT ile mümkün değil', async () => {
    const client = createUserClient(token)
    await assertInsertBlocked(client, 'feedback', {
      school_id: school.id, user_id: ogretmen.id, role: 'mudur',
      page_path: '/', category: 'sikayet', message: 'rol sahteciliği denemesi',
    })
  })

  it('submit_feedback ok döner; kimlik alanları DB\'de türetilir', async () => {
    const client = createUserClient(token)
    const { data, error } = await client.rpc('submit_feedback', {
      p_category: 'oneri', p_message: 'RPC testi mesajı', p_page_path: '/yoklama',
    })
    expect(error).toBeNull()
    expect(data).toBe('ok')

    const { data: rows } = await serviceDb
      .from('feedback')
      .select('school_id, role, page_path')
      .eq('user_id', ogretmen.id)
    expect(rows).toHaveLength(1)
    expect(rows?.[0]?.school_id).toBe(school.id) // istemciden alınmadı
    expect(rows?.[0]?.role).toBe('ogretmen')     // spoof edilemez
    expect(rows?.[0]?.page_path).toBe('/yoklama')
  })

  it('geçersiz kategori RPC\'de exception üretir, satır yazılmaz', async () => {
    // Rate-limit testinden ÖNCE koşmalı: limit dolduktan sonra RPC 'rate_limited'
    // döner ve INSERT'e (tablo CHECK'ine) hiç ulaşmaz.
    const client = createUserClient(token)
    const { error } = await client.rpc('submit_feedback', {
      p_category: 'hack', p_message: 'geçersiz kategori', p_page_path: '/',
    })
    expect(error).not.toBeNull() // tablo CHECK'i engeller
  })

  it('60 sn içinde 4. gönderim rate_limited döner', async () => {
    const client = createUserClient(token)
    // 1 kayıt önceki testten var; 2 tane daha → toplam 3
    for (const n of [2, 3]) {
      const { data } = await client.rpc('submit_feedback', {
        p_category: 'istek', p_message: `hızlı gönderim ${n}`, p_page_path: '/',
      })
      expect(data).toBe('ok')
    }
    const { data: fourth, error } = await client.rpc('submit_feedback', {
      p_category: 'istek', p_message: 'dördüncü gönderim', p_page_path: '/',
    })
    expect(error).toBeNull()
    expect(fourth).toBe('rate_limited')

    const { data: rows } = await serviceDb
      .from('feedback').select('id').eq('user_id', ogretmen.id)
    expect(rows).toHaveLength(3) // 4. kayıt yazılmadı
  })

  it('kendi kaydını bile okuyamaz (SELECT policy yok)', async () => {
    const client = createUserClient(token)
    const { data, error } = await client.from('feedback').select('*')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('view\'lar authenticated için boş döner', async () => {
    const client = createUserClient(token)
    const { data } = await client.from('usage_summary').select('*')
    expect(data ?? []).toHaveLength(0)
  })
})
