/**
 * Token revocation (revoked_tokens) RLS testleri.
 *
 * revoked_tokens tablosunun 3 politikası:
 *   1. revoked_tokens_anon_read  : anon + authenticated → SELECT (token doğrulama için)
 *   2. revoked_tokens_baskan_insert : authenticated + is_zumre_baskani_in_school() → INSERT
 *   3. revoked_tokens_baskan_delete : authenticated + is_zumre_baskani_in_school() → DELETE
 *
 * Güvenlik tasarımı notu:
 *   Token iptali sadece zumre_baskani'na verilmiştir (mudur dahil değil).
 *   Bu bilinçli bir tasarım kararıdır; mudur şu an token iptal edemez.
 *   Eğer bu değiştirilmek istenirse migration + test güncellenmeli.
 *
 * Saldırı vektörleri:
 *   A. Düşük yetkili kullanıcı (ogretmen, mudur_yardimcisi, mudur) token iptal etmeye çalışır
 *   B. Anonim kullanıcı token iptal etmeye çalışır
 *   C. Herhangi bir kullanıcı revoked_tokens kaydını silmeye çalışır (restore saldırısı)
 *   D. Saldırgan kendi jti'sini revoked_tokens'tan silip token'ı reaktive etmeye çalışır
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

  ;[ogretmen, baskan, mudur, my] = await Promise.all([
    createTestUser({ role: 'ogretmen',         schoolId: school.id }),
    createTestUser({ role: 'zumre_baskani',    schoolId: school.id }),
    createTestUser({ role: 'mudur',            schoolId: school.id }),
    createTestUser({ role: 'mudur_yardimcisi', schoolId: school.id }),
  ])

  ;[tokenOg, tokenBaskan, tokenMudur, tokenMy] = await Promise.all([
    signInTestUser(ogretmen.email, ogretmen.password),
    signInTestUser(baskan.email,   baskan.password),
    signInTestUser(mudur.email,    mudur.password),
    signInTestUser(my.email,       my.password),
  ])
})

afterAll(async () => {
  // Eklenen test tokenlarını temizle
  if (insertedJtis.length) {
    await serviceDb.from('revoked_tokens').delete().in('jti', insertedJtis)
  }
  await cleanupTestData({ userIds: [ogretmen.id, baskan.id, mudur.id, my.id], schoolIds: [school.id] })
})

// ─── SELECT: herkes okuyabilir (token doğrulama için açık) ───────────────────
describe('revoked_tokens SELECT: herkese açık (token doğrulama)', () => {
  let testJti: string

  beforeAll(async () => {
    testJti = `${TEST_JTI_BASE}-read-test`
    await serviceDb.from('revoked_tokens').insert({
      jti: testJti, token_type: 'veli', revoked_by: baskan.id, reason: 'test',
    })
    insertedJtis.push(testJti)
  })

  it('anonim kullanıcı revoked_tokens okuyabilir', async () => {
    const client = createAnonClient()
    const { data, error } = await client
      .from('revoked_tokens').select('jti').eq('jti', testJti)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  it('authenticated öğretmen revoked_tokens okuyabilir', async () => {
    const client = createUserClient(tokenOg)
    const { data, error } = await client
      .from('revoked_tokens').select('jti').eq('jti', testJti)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  it('authenticated müdür revoked_tokens okuyabilir', async () => {
    const client = createUserClient(tokenMudur)
    const { data, error } = await client
      .from('revoked_tokens').select('jti').eq('jti', testJti)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })
})

// ─── INSERT: sadece zumre_baskani ────────────────────────────────────────────
describe('revoked_tokens INSERT: sadece zumre_baskani', () => {
  it('zumre_baskani token iptal edebilir', async () => {
    const jti = `${TEST_JTI_BASE}-baskan-insert`
    const client = createUserClient(tokenBaskan)
    const { error } = await client.from('revoked_tokens').insert({
      jti, token_type: 'veli', revoked_by: baskan.id, reason: 'test',
    })
    expect(error).toBeNull()
    insertedJtis.push(jti)
  })

  it('öğretmen token iptal edemez — yetkisiz', async () => {
    // Saldırı A: düşük yetkili kullanıcı token iptali
    const jti = `${TEST_JTI_BASE}-ogretmen-attempt`
    await assertInsertBlocked(
      createUserClient(tokenOg),
      'revoked_tokens',
      { jti, token_type: 'veli', revoked_by: ogretmen.id, reason: 'attack' },
      'ogretmen-insert'
    )
  })

  it('mudur_yardimcisi token iptal edemez — tasarım gereği', async () => {
    // Saldırı A: MY token iptali deneme
    // Not: mudur_yardimcisi zumre_baskani değildir; is_zumre_baskani_in_school() false döner
    const jti = `${TEST_JTI_BASE}-my-attempt`
    await assertInsertBlocked(
      createUserClient(tokenMy),
      'revoked_tokens',
      { jti, token_type: 'veli', revoked_by: my.id, reason: 'attack' },
      'mudur_yardimcisi-insert'
    )
  })

  it('mudur token iptal edemez — tasarım gereği sadece baskan', async () => {
    // Saldırı A: mudur token iptali deneme
    // Güvenlik notu: mudur gerekirse bu politika değiştirilmeli ve test güncellenmeli
    const jti = `${TEST_JTI_BASE}-mudur-attempt`
    await assertInsertBlocked(
      createUserClient(tokenMudur),
      'revoked_tokens',
      { jti, token_type: 'veli', revoked_by: mudur.id, reason: 'attack' },
      'mudur-insert'
    )
  })

  it('anonim kullanıcı token iptal edemez', async () => {
    // Saldırı B: anon INSERT girişimi
    const jti = `${TEST_JTI_BASE}-anon-attempt`
    const client = createAnonClient()
    const { error } = await client.from('revoked_tokens').insert({
      jti, token_type: 'veli', reason: 'attack',
    })
    expect(error).not.toBeNull()
  })
})

// ─── DELETE: token'ı "unrevoking" saldırısı ──────────────────────────────────
describe('revoked_tokens DELETE: restore saldırısı engellenmeli', () => {
  let protectedJti: string

  beforeAll(async () => {
    protectedJti = `${TEST_JTI_BASE}-protected`
    await serviceDb.from('revoked_tokens').insert({
      jti: protectedJti, token_type: 'yoklama', revoked_by: baskan.id, reason: 'protect test',
    })
    insertedJtis.push(protectedJti)
  })

  /**
   * revoked_tokens PK = jti (text), 'id' değil — assertDeleteBlocked helper yerine
   * inline sorgular kullanıyoruz.
   *
   * Saldırı D: iptal edilmiş token'ın jti'sini bilen saldırgan kaydı silerek
   * token'ı geçerli hale getirmeye çalışır (restore attack).
   */
  async function assertJtiNotDeleted(actorClient: ReturnType<typeof createUserClient> | ReturnType<typeof createAnonClient>) {
    await actorClient.from('revoked_tokens').delete().eq('jti', protectedJti)
    const { data } = await serviceDb.from('revoked_tokens').select('jti').eq('jti', protectedJti)
    expect(data ?? [], 'revoked token silinmiş olmamalı (restore saldırısı engeli)').toHaveLength(1)
  }

  it('öğretmen iptal edilmiş token kaydını silemez', async () => {
    await assertJtiNotDeleted(createUserClient(tokenOg))
  })

  it('mudur iptal edilmiş token kaydını silemez', async () => {
    await assertJtiNotDeleted(createUserClient(tokenMudur))
  })

  it('anonim kullanıcı token kaydını silemez', async () => {
    await assertJtiNotDeleted(createAnonClient())
  })

  it('zumre_baskani kendi eklediği token kaydını silebilir', async () => {
    // Meşru iptal geri alma: baskan kendi okulunun token'ını silebilir
    const jti = `${TEST_JTI_BASE}-baskan-delete`
    await serviceDb.from('revoked_tokens').insert({
      jti, token_type: 'veli', revoked_by: baskan.id, reason: 'to be deleted',
    })

    const client = createUserClient(tokenBaskan)
    const { error } = await client.from('revoked_tokens').delete().eq('jti', jti)
    expect(error).toBeNull()

    // Gerçekten silindi mi?
    const { data } = await serviceDb.from('revoked_tokens').select('jti').eq('jti', jti)
    expect(data ?? []).toHaveLength(0)
  })
})
