/**
 * 2026-10-03: veli görüşme notu (addParentContactLog) ve veli randevusu (MeetingService.create) öğrencinin
 * kendi okulunda olduğunu doğrulamıyordu (öğrenci notu ve mentörlük doğruluyordu). Service client RLS'i
 * atladığı için bu test tam olarak servis kontrolünü ölçer.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { serviceDb, createTestSchool, createTestUser, cleanupTestData, type TestSchool, type TestUser } from '../../setup/db'
import { makeProfile, makeUser, OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/auth', () => ({
  getCurrentUser:        vi.fn(),
  getCurrentProfile:     vi.fn(),
  getCurrentPermissions: vi.fn(),
  requireSchoolId:       vi.fn(),
}))
vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(serviceDb),
}))

const { getCurrentUser, getCurrentProfile, getCurrentPermissions, requireSchoolId } = await import('@/src/shared/auth')
const { ClassService } = await import('@/src/domains/classes/services/ClassService')
const { MeetingService } = await import('@/src/domains/meetings/services/MeetingService')

let okul: TestSchool, digerOkul: TestSchool, ogretmen: TestUser
let yabanciOgrenci: string, kendiOgrenci: string

beforeAll(async () => {
  okul = await createTestSchool('_BAG')
  digerOkul = await createTestSchool('_BAG2')
  ogretmen = await createTestUser({ role: 'ogretmen', schoolId: okul.id })
  const sinif = async (sid: string) => (await serviceDb.from('classes')
    .insert({ name: 'Bağ', grade: 9, academic_year: '2099-2100', school_id: sid }).select('id').single()).data!.id
  const ogr = async (sid: string, cid: string) => (await serviceDb.from('students')
    .insert({ full_name: 'Öğr', class_id: cid, school_id: sid }).select('id').single()).data!.id
  kendiOgrenci = await ogr(okul.id, await sinif(okul.id))
  yabanciOgrenci = await ogr(digerOkul.id, await sinif(digerOkul.id))
})

afterAll(async () => {
  await serviceDb.from('parent_contact_logs').delete().in('school_id', [okul.id, digerOkul.id])
  await serviceDb.from('parent_meetings').delete().in('school_id', [okul.id, digerOkul.id])
  await cleanupTestData({ userIds: [ogretmen.id], schoolIds: [okul.id, digerOkul.id] })
})

beforeEach(() => {
  vi.clearAllMocks()
  const user = Object.assign(makeUser(okul.id), { id: ogretmen.id })
  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
  vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('ogretmen', okul.id) as never)
  vi.mocked(getCurrentPermissions).mockResolvedValue(OGRETMEN_PERMS as never)
  vi.mocked(requireSchoolId).mockResolvedValue(okul.id)
})

describe('öğrenci başka okuldaysa kayıt açılmaz', () => {
  it('veli görüşme notu: başka okulun öğrencisi → hata, satır yok', async () => {
    await expect(ClassService.addParentContactLog(yabanciOgrenci, {
      note: 'x', contact_method: 'telefon', contacted_at: new Date().toISOString(),
    })).rejects.toThrow()
    const { data } = await serviceDb.from('parent_contact_logs').select('id').eq('student_id', yabanciOgrenci)
    expect(data ?? []).toHaveLength(0)
  })

  it('veli randevusu: başka okulun öğrencisi → hata, satır yok', async () => {
    const r = await MeetingService.create({ studentId: yabanciOgrenci, meetDate: '2099-06-01', period: 1, note: null })
    expect(r.error).toBeTruthy()
    const { data } = await serviceDb.from('parent_meetings').select('id').eq('student_id', yabanciOgrenci)
    expect(data ?? []).toHaveLength(0)
  })

  it('kendi okulunun öğrencisi için görüşme notu yazılır', async () => {
    await ClassService.addParentContactLog(kendiOgrenci, {
      note: 'ok', contact_method: 'telefon', contacted_at: new Date().toISOString(),
    })
    const { data } = await serviceDb.from('parent_contact_logs').select('id').eq('student_id', kendiOgrenci)
    expect(data ?? []).toHaveLength(1)
  })
})
