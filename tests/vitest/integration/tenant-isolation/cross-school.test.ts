/**
 * Tenant izolasyon testleri — RLS üzerinden.
 * Okul A kullanıcısının Okul B verisine erişemediğini doğrular.
 * Gerçek Supabase credentials gerektirir.
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

// ── Test fixture'ları ─────────────────────────────────────────

let schoolA: TestSchool
let schoolB: TestSchool
let userA:   TestUser    // Okul A öğretmeni
let userB:   TestUser    // Okul B öğretmeni
let tokenA:  string
let tokenB:  string

// Okul A'ya ait test verileri
let classA_id:    string
let homeworkA_id: string
let studentA_id:  string

beforeAll(async () => {
  // 2 ayrı okul oluştur
  ;[schoolA, schoolB] = await Promise.all([
    createTestSchool('_A'),
    createTestSchool('_B'),
  ])

  // Her okulda bir öğretmen
  ;[userA, userB] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: schoolA.id }),
    createTestUser({ role: 'ogretmen', schoolId: schoolB.id }),
  ])

  // Token al
  ;[tokenA, tokenB] = await Promise.all([
    signInTestUser(userA.email, userA.password),
    signInTestUser(userB.email, userB.password),
  ])

  // Okul A'ya veri ekle (service client)
  const { data: cls } = await serviceDb
    .from('classes')
    .insert({ name: 'Test Sınıf A', grade: 5, academic_year: '2025-2026', school_id: schoolA.id })
    .select('id').single()
  classA_id = cls!.id

  const { data: hw } = await serviceDb
    .from('homeworks')
    .insert({
      teacher_id: userA.id,
      class_id:   classA_id,
      school_id:  schoolA.id,
      title:      'Okul A Ödevi',
      subject:    'Matematik',
      due_date:   '2026-12-31',
      description: null,
    })
    .select('id').single()
  homeworkA_id = hw!.id

  const { data: stu } = await serviceDb
    .from('students')
    .insert({ full_name: 'Okul A Öğrenci', student_number: null, class_id: classA_id, school_id: schoolA.id })
    .select('id').single()
  studentA_id = stu!.id
})

afterAll(async () => {
  await cleanupTestData({
    userIds:  [userA.id, userB.id],
    schoolIds: [schoolA.id, schoolB.id],
  })
})

// ─────────────────────────────────────────────────────────────
describe('Okul B kullanıcısı Okul A verisini okuyamaz', () => {
  it('homeworks — okul B kullanıcısı okul A ödevlerini göremez', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client
      .from('homeworks')
      .select('id')
      .eq('school_id', schoolA.id)

    expect(data).toHaveLength(0)
  })

  it('students — okul B kullanıcısı okul A öğrencilerini göremez', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client
      .from('students')
      .select('id')
      .eq('school_id', schoolA.id)

    expect(data).toHaveLength(0)
  })

  it('classes — okul B kullanıcısı okul A sınıflarını göremez', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client
      .from('classes')
      .select('id')
      .eq('school_id', schoolA.id)

    expect(data).toHaveLength(0)
  })

  it('attendance — okul B kullanıcısı okul A yoklamalarını göremez', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client
      .from('attendance')
      .select('id')
      .eq('school_id', schoolA.id)

    expect(data).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────
describe('Okul B kullanıcısı Okul A verisine yazamaz', () => {
  it('homeworks — okul B kullanıcısı okul A için ödev ekleyemez', async () => {
    const client = createUserClient(tokenB)
    const { error } = await client.from('homeworks').insert({
      teacher_id:  userB.id,
      class_id:    classA_id,        // Okul A'nın sınıfı!
      school_id:   schoolA.id,       // Okul A'nın ID'si!
      title:       'Saldırı Ödevi',
      subject:     'Matematik',
      due_date:    '2026-12-31',
      description: null,
    })

    expect(error).not.toBeNull()
  })

  it('students — okul B kullanıcısı okul A öğrencisi ekleyemez', async () => {
    const client = createUserClient(tokenB)
    const { error } = await client.from('students').insert({
      full_name:      'Yetkisiz Öğrenci',
      student_number: null,
      class_id:       classA_id,
      school_id:      schoolA.id,
    })

    expect(error).not.toBeNull()
  })

  it('attendance — okul B kullanıcısı okul A için yoklama giremez', async () => {
    const client = createUserClient(tokenB)
    const { error } = await client.from('attendance').insert({
      teacher_id: userB.id,
      class_id:   classA_id,
      student_id: studentA_id,
      school_id:  schoolA.id,
      date:       '2026-01-01',
      status:     'present',
    })

    expect(error).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
describe('Okul A kullanıcısı kendi verisini okuyabilir', () => {
  it('homeworks — okul A kullanıcısı kendi ödevlerini görür', async () => {
    const client = createUserClient(tokenA)
    const { data, error } = await client
      .from('homeworks')
      .select('id')
      .eq('school_id', schoolA.id)

    expect(error).toBeNull()
    expect(data!.some(hw => hw.id === homeworkA_id)).toBe(true)
  })

  it('students — okul A kullanıcısı kendi öğrencilerini görür', async () => {
    const client = createUserClient(tokenA)
    const { data, error } = await client
      .from('students')
      .select('id')
      .eq('school_id', schoolA.id)

    expect(error).toBeNull()
    expect(data!.some(s => s.id === studentA_id)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
describe('Anonymous kullanıcı hiçbir veriye erişemez', () => {
  it('homeworks — anon okuyamaz', async () => {
    const { createAnonClient } = await import('../../setup/db')
    const client = createAnonClient()
    const { data } = await client.from('homeworks').select('id').limit(1)
    expect(data).toHaveLength(0)
  })

  it('students — anon okuyamaz', async () => {
    const { createAnonClient } = await import('../../setup/db')
    const client = createAnonClient()
    const { data } = await client.from('students').select('id').limit(1)
    expect(data).toHaveLength(0)
  })

  it('profiles — anon okuyamaz', async () => {
    const { createAnonClient } = await import('../../setup/db')
    const client = createAnonClient()
    const { data } = await client.from('profiles').select('id').limit(1)
    expect(data).toHaveLength(0)
  })
})
