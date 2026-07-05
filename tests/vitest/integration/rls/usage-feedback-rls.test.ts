/**
 * usage_daily + feedback RLS testleri.
 * DİKKAT: Bu tablolarda SELECT policy yok — assertInsertAllowed (insert().select())
 * KULLANILAMAZ; düz insert + serviceDb doğrulaması yapılır.
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

describe('feedback INSERT policy', () => {
  it('kendi adına, kendi okuluna INSERT edebilir (select olmadan)', async () => {
    const client = createUserClient(token)
    const { error } = await client.from('feedback').insert({
      school_id: school.id, user_id: ogretmen.id, role: 'ogretmen',
      page_path: '/yoklama', category: 'oneri', message: 'RLS testi mesajı',
    })
    expect(error).toBeNull()

    const { data } = await serviceDb
      .from('feedback').select('id').eq('user_id', ogretmen.id)
    expect(data).toHaveLength(1)
  })

  it('başka kullanıcı adına INSERT engellenir', async () => {
    const client = createUserClient(token)
    await assertInsertBlocked(client, 'feedback', {
      school_id: school.id, user_id: '00000000-0000-0000-0000-000000000001',
      role: 'ogretmen', page_path: '/', category: 'oneri', message: 'sahte kayıt',
    })
  })

  it('başka okul adına INSERT engellenir', async () => {
    const client = createUserClient(token)
    await assertInsertBlocked(client, 'feedback', {
      school_id: school2.id, user_id: ogretmen.id,
      role: 'ogretmen', page_path: '/', category: 'oneri', message: 'yanlış okul',
    })
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
