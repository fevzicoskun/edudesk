/**
 * Token revocation (revoked_tokens) RLS testleri.
 *
 * revoked_tokens tablosunun politikaları (v3 — 20261003020000: okul bağı; v2 — 20260524100000):
 *   1. revoked_tokens_okul_read     : authenticated + kendi okulu → SELECT (eskiden TÜM okullar)
 *   2. revoked_tokens_manager_insert: authenticated + can_revoke_tokens() → INSERT
 *   3. revoked_tokens_manager_delete: authenticated + can_revoke_tokens() → DELETE
 *
 * can_revoke_tokens() = mudur | mudur_yardimcisi | zumre_baskani
 *
 * Saldırı vektörleri:
 *   A. Yetkisiz kullanıcı (ogretmen) token iptal etmeye çalışır
 *   B. Anonim kullanıcı token iptal etmeye çalışır
 *   C. Yetkisiz kullanıcı revoked_tokens kaydını silip token'ı reaktive etmeye çalışır (restore attack)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'crypto'
import {
  serviceDb,
  createUserClient,
  createAnonClient,
  createTestSchool,
  createTestUser,
  signInTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'
import { assertInsertBlocked } from './rls-assert'

let school:   TestSchool
let digerOkul: TestSchool
let digerMudur: TestUser
let tokenDigerMudur: string
let ogretmen: TestUser
let baskan:   TestUser
let mudur:    TestUser
let my:       TestUser  // mudur_yardimcisi

let tokenOg:    string
let tokenBaskan: string
let tokenMudur:  string
let tokenMy:     string

// Testler arası paylaşılan JTI
const TEST_JTI_BASE = `test-jti-${randomUUID().slice(0, 8)}`
const insertedJtis: string[] = []

beforeAll(async () => {
  school = await createTestSchool('_TOKEN')
  digerOkul = await createTestSchool('_TOKEN2')
  digerMudur = await createTestUser({ role: 'mudur', schoolId: digerOkul.id })

  ;[ogretmen, baskan, mudur, my] = await Promise.all([
    createTestUser({ role: 'ogretmen',         schoolId: school.id }),
    createTestUser({ role: 'zumre_baskani',    schoolId: school.id }),
    createTestUser({ role: 'mudur',            schoolId: school.id }),
    createTestUser({ role: 'mudur_yardimcisi', schoolId: school.id }),
  ])

  // sırayla — paralel giriş Supabase auth hız sınırını tetikliyordu
  tokenOg     = await signInTestUser(ogretmen.email, ogretmen.password)
  tokenBaskan = await signInTestUser(baskan.email,   baskan.password)
  tokenMudur  = await signInTestUser(mudur.email,    mudur.password)
  tokenMy     = await signInTestUser(my.email,       my.password)
  tokenDigerMudur = await signInTestUser(digerMudur.email, digerMudur.password)
}, 120_000)

afterAll(async () => {
  // Eklenen test tokenlarını temizle
  if (insertedJtis.length) {
    await serviceDb.from('revoked_tokens').delete().in('jti', insertedJtis)
  }
  await cleanupTestData({ userIds: [ogretmen.id, baskan.id, mudur.id, my.id, digerMudur.id], schoolIds: [school.id, digerOkul.id] })
})

// ─── SELECT: yalnızca authenticated ─────────────────────────────────────────
describe('revoked_tokens SELECT: yalnızca authenticated', () => {
  let testJti: string

  beforeAll(async () => {
    testJti = `${TEST_JTI_BASE}-read-test`
    await serviceDb.from('revoked_tokens').insert({
      jti: testJti, school_id: school.id, token_type: 'veli', revoked_by: baskan.id, reason: 'test',
    })
    insertedJtis.push(testJti)
  })

  it('anonim kullanıcı revoked_tokens okuyamaz', async () => {
    const client = createAnonClient()
    const { data } = await client
      .from('revoked_tokens').select('jti').eq('jti', testJti)
    expect(data ?? []).toHaveLength(0)
  })

  it('authenticated öğretmen revoked_tokens okuyabilir', async () => {
    const client = createUserClient(tokenOg)
    const { data, error } = await client
      .from('revoked_tokens').select('jti').eq('jti', testJti)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  // 2026-10-03: tabloda okul yoktu, SELECT her girişliye açıktı → başka okulun iptal kayıtları (gerekçe dahil) görünüyordu
  it('başka okulun müdürü bu okulun iptal kaydını göremez', async () => {
    const { data, error } = await createUserClient(tokenDigerMudur)
      .from('revoked_tokens').select('jti').eq('jti', testJti)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('authenticated müdür revoked_tokens okuyabilir', async () => {
    const client = createUserClient(tokenMudur)
    const { data, error } = await client
      .from('revoked_tokens').select('jti').eq('jti', testJti)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })
})

// ─── INSERT: can_revoke_tokens() = mudur | MY | zumre_baskani ───────────────
describe('revoked_tokens INSERT: can_revoke_tokens() rolleri', () => {
  it('zumre_baskani token iptal edebilir', async () => {
    const jti = `${TEST_JTI_BASE}-baskan-insert`
    const client = createUserClient(tokenBaskan)
    const { error } = await client.from('revoked_tokens').insert({
      jti, school_id: school.id, token_type: 'veli', revoked_by: baskan.id, reason: 'test',
    })
    expect(error).toBeNull()
    insertedJtis.push(jti)
  })

  it('mudur token iptal edebilir', async () => {
    const jti = `${TEST_JTI_BASE}-mudur-insert`
    const client = createUserClient(tokenMudur)
    const { error } = await client.from('revoked_tokens').insert({
      jti, school_id: school.id, token_type: 'veli', revoked_by: mudur.id, reason: 'test',
    })
    expect(error).toBeNull()
    insertedJtis.push(jti)
  })

  it('mudur_yardimcisi token iptal edebilir', async () => {
    const jti = `${TEST_JTI_BASE}-my-insert`
    const client = createUserClient(tokenMy)
    const { error } = await client.from('revoked_tokens').insert({
      jti, school_id: school.id, token_type: 'veli', revoked_by: my.id, reason: 'test',
    })
    expect(error).toBeNull()
    insertedJtis.push(jti)
  })

  it('öğretmen token iptal edemez — yetkisiz (saldırı A)', async () => {
    const jti = `${TEST_JTI_BASE}-ogretmen-attempt`
    await assertInsertBlocked(
      createUserClient(tokenOg),
      'revoked_tokens',
      { jti, school_id: school.id, token_type: 'veli', revoked_by: ogretmen.id, reason: 'attack' },
      'ogretmen-insert'
    )
  })

  it('müdür başka okul adına iptal kaydı yazamaz', async () => {
    const jti = `${TEST_JTI_BASE}-yabanci-okul`
    await assertInsertBlocked(
      createUserClient(tokenMudur),
      'revoked_tokens',
      { jti, school_id: digerOkul.id, token_type: 'veli', revoked_by: mudur.id, reason: 'attack' },
      'yabanci-okul-insert'
    )
  })

  it('anonim kullanıcı token iptal edemez (saldırı B)', async () => {
    const jti = `${TEST_JTI_BASE}-anon-attempt`
    const client = createAnonClient()
    const { error } = await client.from('revoked_tokens').insert({
      jti, token_type: 'veli', reason: 'attack',
    })
    expect(error).not.toBeNull()
  })
})

// ─── DELETE: restore saldırısı engellenmeli ──────────────────────────────────
describe('revoked_tokens DELETE: yetkisiz kullanıcı restore saldırısı', () => {
  let protectedJti: string

  beforeAll(async () => {
    protectedJti = `${TEST_JTI_BASE}-protected`
    await serviceDb.from('revoked_tokens').insert({
      jti: protectedJti, school_id: school.id, token_type: 'yoklama', revoked_by: baskan.id, reason: 'protect test',
    })
    insertedJtis.push(protectedJti)
  })

  /**
   * Saldırı C/D: yetkisiz aktör jti'yi silerek token'ı reaktive etmeye çalışır.
   * can_revoke_tokens() false → DELETE engellenir, kayıt yerinde kalır.
   */
  async function assertJtiNotDeleted(actorClient: ReturnType<typeof createUserClient> | ReturnType<typeof createAnonClient>) {
    await actorClient.from('revoked_tokens').delete().eq('jti', protectedJti)
    const { data } = await serviceDb.from('revoked_tokens').select('jti').eq('jti', protectedJti)
    expect(data ?? [], 'revoked token silinmiş olmamalı (restore saldırısı engeli)').toHaveLength(1)
  }

  it('öğretmen iptal edilmiş token kaydını silemez (saldırı C)', async () => {
    await assertJtiNotDeleted(createUserClient(tokenOg))
  })

  it('anonim kullanıcı token kaydını silemez (saldırı C)', async () => {
    await assertJtiNotDeleted(createAnonClient())
  })

  it('zumre_baskani token kaydını silebilir (can_revoke_tokens)', async () => {
    const jti = `${TEST_JTI_BASE}-baskan-delete`
    await serviceDb.from('revoked_tokens').insert({
      jti, school_id: school.id, token_type: 'veli', revoked_by: baskan.id, reason: 'to be deleted',
    })
    const client = createUserClient(tokenBaskan)
    const { error } = await client.from('revoked_tokens').delete().eq('jti', jti)
    expect(error).toBeNull()
    const { data } = await serviceDb.from('revoked_tokens').select('jti').eq('jti', jti)
    expect(data ?? []).toHaveLength(0)
  })

  it('başka okulun müdürü bu okulun iptal kaydını silip linki diriltemez', async () => {
    await assertJtiNotDeleted(createUserClient(tokenDigerMudur))
  })

  it('mudur token kaydını silebilir (can_revoke_tokens)', async () => {
    const jti = `${TEST_JTI_BASE}-mudur-delete`
    await serviceDb.from('revoked_tokens').insert({
      jti, school_id: school.id, token_type: 'veli', revoked_by: mudur.id, reason: 'to be deleted',
    })
    const client = createUserClient(tokenMudur)
    const { error } = await client.from('revoked_tokens').delete().eq('jti', jti)
    expect(error).toBeNull()
    const { data } = await serviceDb.from('revoked_tokens').select('jti').eq('jti', jti)
    expect(data ?? []).toHaveLength(0)
  })
})
