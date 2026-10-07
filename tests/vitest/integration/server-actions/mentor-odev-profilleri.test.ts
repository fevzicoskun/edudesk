/**
 * HomeworkService.getMentorHomeworkProfiles + getStudentHomeworkProfile({bas}) — gerçek DB.
 * Mentörün öğrencileri farklı sınıflardan gelir: her öğrenci yalnız KENDİ sınıfının ödevlerini almalı,
 * silinmiş öğrenci dönmemeli, bas filtresi assigned_date'e göre süzmeli (spec 2026-10-07).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  serviceDb, createTestSchool, createTestUser, cleanupTestData,
  type TestSchool, type TestUser,
} from '../../setup/db'
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
const { HomeworkService } = await import('@/src/domains/homework/services/HomeworkService')

let school: TestSchool
let teacher: TestUser
let classA: string, classB: string
let a1: string, a2: string, b1: string
let h1: string, h2: string, h3: string

async function sinif(name: string) {
  const { data, error } = await serviceDb.from('classes')
    .insert({ name, grade: 11, academic_year: '2025-2026', school_id: school.id }).select('id').single()
  if (error) throw new Error(error.message)
  return data!.id
}
async function ogrenci(full_name: string, class_id: string) {
  const { data, error } = await serviceDb.from('students')
    .insert({ full_name, student_number: null, class_id, school_id: school.id }).select('id').single()
  if (error) throw new Error(error.message)
  return data!.id
}
async function odev(class_id: string, subject: string, assigned_date: string) {
  const { data, error } = await serviceDb.from('homeworks')
    .insert({ title: `${subject} ödevi`, subject, class_id, school_id: school.id, teacher_id: teacher.id, assigned_date, due_date: '2099-12-31' })
    .select('id').single()
  if (error) throw new Error(error.message)
  return data!.id
}
async function isaretle(homework_id: string, student_id: string, status: string) {
  const { error } = await serviceDb.from('homework_submissions')
    .update({ status, marked_at: new Date().toISOString() })
    .eq('homework_id', homework_id).eq('student_id', student_id)
  if (error) throw new Error(error.message)
}

beforeAll(async () => {
  school = await createTestSchool('_MENTOR_ODEV')
  teacher = await createTestUser({ role: 'ogretmen', schoolId: school.id })
  ;[classA, classB] = await Promise.all([sinif('Mentör A'), sinif('Mentör B')])
  ;[a1, a2, b1] = await Promise.all([ogrenci('Ali A', classA), ogrenci('Silinen A', classA), ogrenci('Berk B', classB)])
  h1 = await odev(classA, 'Matematik', '2026-09-10')
  h2 = await odev(classA, 'Fizik', '2026-09-25')
  h3 = await odev(classB, 'Kimya', '2026-09-25')
  await isaretle(h1, a1, 'yapildi')
  await isaretle(h3, b1, 'eksik')
  await serviceDb.from('students').update({ deleted_at: new Date().toISOString() }).eq('id', a2)
})

afterAll(async () => {
  await serviceDb.from('homework_submissions').delete().in('homework_id', [h1, h2, h3])
  await serviceDb.from('homeworks').delete().in('id', [h1, h2, h3])
  await cleanupTestData({ userIds: [teacher.id], schoolIds: [school.id] })
})

beforeEach(() => {
  vi.clearAllMocks()
  const user = makeUser(school.id)
  Object.assign(user, { id: teacher.id })
  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
  vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('ogretmen', school.id) as never)
  vi.mocked(getCurrentPermissions).mockResolvedValue(OGRETMEN_PERMS as never)
  vi.mocked(requireSchoolId).mockResolvedValue(school.id)
  vi.spyOn(serviceDb.auth, 'getUser').mockResolvedValue({ data: { user: { id: teacher.id } as never }, error: null } as never)
})

describe('HomeworkService.getMentorHomeworkProfiles()', () => {
  it('her öğrenci yalnız kendi sınıfının ödevlerini alır', async () => {
    const r = await HomeworkService.getMentorHomeworkProfiles([a1, b1])
    if ('error' in r) throw new Error(r.error)
    const a = r.ogrenciler.find(o => o.id === a1)!
    const b = r.ogrenciler.find(o => o.id === b1)!
    expect(a.homeworks.map(h => h.id).sort()).toEqual([h1, h2].sort())
    expect(b.homeworks.map(h => h.id)).toEqual([h3])
    expect(b.homeworks[0].status).toBe('eksik')
    expect(a.homeworks.find(h => h.id === h1)!.status).toBe('yapildi')
    expect(a.class_name).toBe('Mentör A')
    expect(b.class_name).toBe('Mentör B')
  })

  it('bas filtresi assigned_date ile süzer', async () => {
    const r = await HomeworkService.getMentorHomeworkProfiles([a1], '2026-09-20')
    if ('error' in r) throw new Error(r.error)
    expect(r.ogrenciler[0].homeworks.map(h => h.id)).toEqual([h2])
  })

  it('silinmiş öğrenci dönmez', async () => {
    const r = await HomeworkService.getMentorHomeworkProfiles([a1, a2])
    if ('error' in r) throw new Error(r.error)
    expect(r.ogrenciler.map(o => o.id)).toEqual([a1])
  })

  it('boş liste → boş sonuç', async () => {
    expect(await HomeworkService.getMentorHomeworkProfiles([])).toEqual({ ogrenciler: [] })
  })
})

describe('HomeworkService.getStudentHomeworkProfile({ bas })', () => {
  it('bas verilince assigned_date ile süzer, verilmezse hepsi', async () => {
    const suzulmus = await HomeworkService.getStudentHomeworkProfile(a1, classA, { tumOdevler: true, bas: '2026-09-20' })
    if ('error' in suzulmus) throw new Error(suzulmus.error)
    expect(suzulmus.homeworks.map(h => h.id)).toEqual([h2])
    const hepsi = await HomeworkService.getStudentHomeworkProfile(a1, classA, { tumOdevler: true })
    if ('error' in hepsi) throw new Error(hepsi.error)
    expect(hepsi.homeworks.map(h => h.id).sort()).toEqual([h1, h2].sort())
  })
})
