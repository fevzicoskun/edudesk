/**
 * Audit logging entegrasyon testleri.
 * Gerçek DB'ye yazma, WORM koruması ve kayıt doğruluğunu test eder.
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

let school:  TestSchool
let teacher: TestUser
let token:   string
const insertedLogIds: string[] = []

beforeAll(async () => {
  school  = await createTestSchool('_AUDIT')
  teacher = await createTestUser({ role: 'ogretmen', schoolId: school.id })
  token   = await signInTestUser(teacher.email, teacher.password)
})

afterAll(async () => {
  // audit_logs CASCADE school_id ile temizlenir
  await cleanupTestData({
    userIds:   [teacher.id],
    schoolIds: [school.id],
  })
})

// ─────────────────────────────────────────────────────────────
describe('logAudit() — gerçek DB yazma', () => {
  it('audit kaydı doğru alanlarla oluşturulur', async () => {
    const { data, error } = await serviceDb
      .from('audit_logs')
      .insert({
        user_id:    teacher.id,
        action:     'homework.create',
        table_name: 'homeworks',
        record_id:  '00000000-0000-0000-0000-000000000001',
        school_id:  school.id,
        new_data:   { title: 'Entegrasyon Testi' },
      })
      .select('*')
      .single()

    expect(error).toBeNull()
    insertedLogIds.push(data!.id)

    expect(data!.user_id).toBe(teacher.id)
    expect(data!.action).toBe('homework.create')
    expect(data!.table_name).toBe('homeworks')
    expect(data!.school_id).toBe(school.id)
    // created_at geçerli bir tarih olmalı (saat farkı olabilir, strict karşılaştırma yapma)
    expect(new Date(data!.created_at).getFullYear()).toBeGreaterThanOrEqual(2024)
  })

  it('new_data null olabilir', async () => {
    const { data, error } = await serviceDb
      .from('audit_logs')
      .insert({ user_id: teacher.id, action: 'login', school_id: school.id })
      .select('*').single()

    expect(error).toBeNull()
    insertedLogIds.push(data!.id)
    expect(data!.new_data).toBeNull()
    expect(data!.table_name).toBeNull()
  })

  it('birden fazla kayıt arka arkaya eklenebilir', async () => {
    const actions = ['homework.create', 'attendance.save', 'profile.update'] as const
    for (const action of actions) {
      const { data, error } = await serviceDb
        .from('audit_logs')
        .insert({ user_id: teacher.id, action, school_id: school.id })
        .select('id').single()
      expect(error).toBeNull()
      insertedLogIds.push(data!.id)
    }

    const { data: logs } = await serviceDb
      .from('audit_logs')
      .select('action')
      .eq('user_id', teacher.id)
      .eq('school_id', school.id)
      .in('action', actions)

    expect(logs!.length).toBeGreaterThanOrEqual(3)
  })
})

// ─────────────────────────────────────────────────────────────
describe('Audit log WORM koruması', () => {
  let logId: string

  beforeAll(async () => {
    const { data } = await serviceDb
      .from('audit_logs')
      .insert({ user_id: teacher.id, action: 'token.generate', school_id: school.id })
      .select('id').single()
    logId = data!.id
    insertedLogIds.push(logId)
  })

  it('authenticated kullanıcı audit log güncelleyemez', async () => {
    // RLS UPDATE politikası yok → satır görünmez → 0 etkilenen satır, hata değil
    const client = createUserClient(token)
    const { data, error } = await client
      .from('audit_logs')
      .update({ action: 'tampered' })
      .eq('id', logId)
      .select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)  // hiçbir satır güncellenmedi

    // Orijinal değer korunmuş
    const { data: orig } = await serviceDb
      .from('audit_logs').select('action').eq('id', logId).single()
    expect(orig!.action).toBe('token.generate')
  })

  it('authenticated kullanıcı audit log silemez', async () => {
    // RLS DELETE politikası yok → satır görünmez → 0 silinen satır, hata değil
    const client = createUserClient(token)
    const { data, error } = await client
      .from('audit_logs')
      .delete()
      .eq('id', logId)
      .select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)  // hiçbir satır silinmedi

    // Kayıt hâlâ var
    const { data: check } = await serviceDb
      .from('audit_logs').select('id').eq('id', logId)
    expect(check).toHaveLength(1)
  })

  it('authenticated kullanıcı bile kendi okulunun dışındaki logu göremez', async () => {
    // Başka bir okul için kayıt ekle (service ile)
    const otherSchool = await createTestSchool('_AUDIT_OTHER')
    const { data: otherLog } = await serviceDb
      .from('audit_logs')
      .insert({ user_id: teacher.id, action: 'login', school_id: otherSchool.id })
      .select('id').single()

    const client = createUserClient(token)
    const { data } = await client
      .from('audit_logs').select('id').eq('id', otherLog!.id)
    expect(data).toHaveLength(0)

    // Temizle
    await serviceDb.from('audit_logs').delete().eq('school_id', otherSchool.id)
    await serviceDb.from('schools').delete().eq('id', otherSchool.id)
  })
})

// ─────────────────────────────────────────────────────────────
describe('Audit log okul izolasyonu', () => {
  it('öğretmen sadece kendi okul loglarını görebilir', async () => {
    const client = createUserClient(token)
    const { data } = await client
      .from('audit_logs')
      .select('school_id')
      .eq('user_id', teacher.id)
      .limit(50)

    // Dönen tüm kayıtlar kendi okuluna ait olmalı
    const others = (data ?? []).filter(r => r.school_id !== school.id)
    expect(others).toHaveLength(0)
  })
})
