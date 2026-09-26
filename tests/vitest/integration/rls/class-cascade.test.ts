/**
 * Sınıf silme / geri yükleme cascade'i (2026-09-26 bulgusu), gerçek JWT'lerle.
 *
 * 1) Fonksiyon invoker'dı: homeworks_owner_update yalnız sahibine izin verdiği için müdür sınıfı
 *    silince BAŞKA öğretmenlerin ödevleri sessizce atlanıp silinmiş sınıfa bağlı canlı kalıyordu.
 * 2) Geri yükleme sınıftaki TÜM silinmiş satırları diriltiyordu — sınıftan önce tek tek silinmiş
 *    ödev/öğrenciler de geri geliyordu (canlıda silinmiş sınıflarda 13 ödev + 8 öğrenci böyleydi).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb, createUserClient, createTestSchool, createTestUser, signInTestUser, cleanupTestData,
  type TestSchool, type TestUser,
} from '../../setup/db'

let school: TestSchool
let mudur: TestUser, ogrA: TestUser, ogrB: TestUser
let mudurToken: string, ogrAToken: string
let classId: string
const id: Record<string, string> = {}

const silinmis = async (tablo: 'homeworks' | 'students' | 'classes', rowId: string) =>
  (await serviceDb.from(tablo).select('deleted_at').eq('id', rowId).single()).data!.deleted_at !== null

beforeAll(async () => {
  school = await createTestSchool('_CASCADE')
  ;[mudur, ogrA, ogrB] = await Promise.all([
    createTestUser({ role: 'mudur', schoolId: school.id }),
    createTestUser({ role: 'ogretmen', schoolId: school.id }),
    createTestUser({ role: 'ogretmen', schoolId: school.id }),
  ])
  ;[mudurToken, ogrAToken] = await Promise.all([
    signInTestUser(mudur.email, mudur.password),
    signInTestUser(ogrA.email, ogrA.password),
  ])
  const { data: cls, error } = await serviceDb.from('classes')
    .insert({ name: 'Cascade Test', grade: 9, academic_year: '2025-2026', school_id: school.id })
    .select('id').single()
  if (error) throw error
  classId = cls!.id

  const hw = async (anahtar: string, teacher: string, deleted_at: string | null = null) => {
    const { data, error: e } = await serviceDb.from('homeworks').insert({
      teacher_id: teacher, class_id: classId, school_id: school.id, title: anahtar, subject: 'Matematik',
      due_date: '2026-12-31', deleted_at,
    }).select('id').single()
    if (e) throw e
    id[anahtar] = data!.id
  }
  const ogrenci = async (anahtar: string, deleted_at: string | null = null) => {
    const { data, error: e } = await serviceDb.from('students')
      .insert({ full_name: anahtar, class_id: classId, school_id: school.id, deleted_at })
      .select('id').single()
    if (e) throw e
    id[anahtar] = data!.id
  }
  const once = '2026-01-01T00:00:00Z' // sınıftan ÖNCE tek tek silinmiş
  await Promise.all([
    hw('hwA', ogrA.id), hw('hwB', ogrB.id), hw('hwEski', ogrA.id, once),
    ogrenci('canli'), ogrenci('eskiSilinen', once),
  ])
})

afterAll(async () => {
  await cleanupTestData({ userIds: [mudur.id, ogrA.id, ogrB.id], schoolIds: [school.id] })
})

describe('sınıf silme / geri yükleme cascade', () => {
  it('öğretmen sınıf silemez — hiçbir satır değişmez', async () => {
    const { error } = await createUserClient(ogrAToken)
      .rpc('soft_delete_class_cascade', { p_class_id: classId, p_school_id: school.id })
    expect(error).not.toBeNull()
    expect(await silinmis('classes', classId)).toBe(false)
    expect(await silinmis('homeworks', id.hwA)).toBe(false)
    expect(await silinmis('students', id.canli)).toBe(false)
  })

  it('müdür sınıfı silince BAŞKA öğretmenlerin ödevleri de silinir', async () => {
    const { error } = await createUserClient(mudurToken)
      .rpc('soft_delete_class_cascade', { p_class_id: classId, p_school_id: school.id })
    expect(error).toBeNull()
    expect(await silinmis('classes', classId)).toBe(true)
    expect(await silinmis('homeworks', id.hwA)).toBe(true)
    expect(await silinmis('homeworks', id.hwB)).toBe(true)
    expect(await silinmis('students', id.canli)).toBe(true)
  })

  it('geri yükleme yalnız cascade ile silinenleri getirir — önceden silinmişler silinmiş kalır', async () => {
    const { error } = await createUserClient(mudurToken)
      .rpc('restore_class_cascade', { p_class_id: classId, p_school_id: school.id })
    expect(error).toBeNull()
    expect(await silinmis('classes', classId)).toBe(false)
    expect(await silinmis('homeworks', id.hwA)).toBe(false)
    expect(await silinmis('homeworks', id.hwB)).toBe(false)
    expect(await silinmis('students', id.canli)).toBe(false)
    expect(await silinmis('homeworks', id.hwEski)).toBe(true)
    expect(await silinmis('students', id.eskiSilinen)).toBe(true)
  })

  it('başka okulun sınıfına dokunulamaz', async () => {
    const baska = await createTestSchool('_CASCADE2')
    try {
      const { data: c } = await serviceDb.from('classes')
        .insert({ name: 'Yabancı', grade: 9, academic_year: '2025-2026', school_id: baska.id }).select('id').single()
      const { error } = await createUserClient(mudurToken)
        .rpc('soft_delete_class_cascade', { p_class_id: c!.id, p_school_id: baska.id })
      expect(error).not.toBeNull()
      expect(await silinmis('classes', c!.id)).toBe(false)
    } finally {
      await cleanupTestData({ userIds: [], schoolIds: [baska.id] })
    }
  })
})
