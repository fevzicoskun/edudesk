/**
 * HomeworkService entegrasyon testleri.
 * Auth katmanı mock'lanır, DB gerçek Supabase ile çalışır.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  serviceDb,
  createTestSchool,
  createTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'
import { makeProfile, makeUser, OGRETMEN_PERMS } from '../../setup/factories'

// ── Auth mock'ları ────────────────────────────────────────────
vi.mock('@/src/shared/auth', () => ({
  getCurrentUser:        vi.fn(),
  getCurrentProfile:     vi.fn(),
  getCurrentPermissions: vi.fn(),
  requireSchoolId:       vi.fn(),
}))

// Server client'ı service client'a yönlendir (auth token gerekmez)
vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(serviceDb),
}))

const { getCurrentUser, getCurrentProfile, getCurrentPermissions, requireSchoolId } =
  await import('@/src/shared/auth')
const { HomeworkService } = await import('@/src/domains/homework/services/HomeworkService')

// ── Test fixture ──────────────────────────────────────────────
let school:   TestSchool
let teacher:  TestUser
let classId:  string
const cleanup: string[] = []  // silinecek homework ID'leri

beforeAll(async () => {
  school  = await createTestSchool('_HW')
  teacher = await createTestUser({ role: 'ogretmen', schoolId: school.id })

  const { data: cls } = await serviceDb
    .from('classes')
    .insert({ name: 'Hw Test Sınıf', grade: 7, academic_year: '2025-2026', school_id: school.id })
    .select('id').single()
  classId = cls!.id
})

afterAll(async () => {
  if (cleanup.length) {
    await serviceDb.from('homework_submissions').delete().in('homework_id', cleanup)
    await serviceDb.from('homeworks').delete().in('id', cleanup)
  }
  await cleanupTestData({
    userIds:   [teacher.id],
    schoolIds: [school.id],
  })
})

function setupTeacherAuth() {
  const user    = makeUser(school.id)
  const profile = makeProfile('ogretmen', school.id)
  Object.assign(user, { id: teacher.id })

  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
  vi.mocked(getCurrentProfile).mockResolvedValue(profile as never)
  vi.mocked(getCurrentPermissions).mockResolvedValue(OGRETMEN_PERMS as never)
  vi.mocked(requireSchoolId).mockResolvedValue(school.id)

  vi.spyOn(serviceDb.auth, 'getUser').mockResolvedValue({
    data: { user: { id: teacher.id } as never },
    error: null,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupTeacherAuth()
})

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.createHomework()', () => {
  it('öğretmen ödev oluşturabilir', async () => {
    const result = await HomeworkService.createHomework({
      class_id:    classId,
      title:       'Entegrasyon Test Ödevi',
      description: null,
      subject:     'Matematik',
      due_date:    '2026-12-31',
    })

    expect(result.error).toBeUndefined()

    // DB'ye gerçekten yazıldığını doğrula
    const { data } = await serviceDb
      .from('homeworks')
      .select('id, title')
      .eq('title', 'Entegrasyon Test Ödevi')
      .eq('school_id', school.id)
    expect(data).toHaveLength(1)
    cleanup.push(data![0].id)
  })

  it('homework:create izni olmayan kullanıcı ödev oluşturamaz', async () => {
    // homework:create izni olmayan kullanıcı simüle et
    vi.mocked(getCurrentPermissions).mockResolvedValue([] as never)

    const result = await HomeworkService.createHomework({
      class_id:    classId,
      title:       'İzinsiz Ödev',
      description: null,
      subject:     'X',
      due_date:    '2026-12-31',
    })

    expect(result.error).toBeTruthy()
  })

  it('giriş yapmamış kullanıcı ödev oluşturamaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(getCurrentProfile).mockResolvedValue(null)
    vi.mocked(getCurrentPermissions).mockResolvedValue([] as never)

    const result = await HomeworkService.createHomework({
      class_id:    classId,
      title:       'Anonim Ödev',
      description: null,
      subject:     'X',
      due_date:    '2026-12-31',
    })

    expect(result.error).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.updateSubmissionStatus()', () => {
  let hwId: string
  let studentId: string

  beforeAll(async () => {
    const { data: hw } = await serviceDb.from('homeworks').insert({
      teacher_id: teacher.id, class_id: classId, school_id: school.id,
      title: 'Submission Test', subject: 'Mat', due_date: '2026-12-31', description: null,
    }).select('id').single()
    hwId = hw!.id
    cleanup.push(hwId)

    const { data: stu } = await serviceDb.from('students').insert({
      full_name: 'Submission Öğrenci', student_number: null,
      class_id: classId, school_id: school.id,
    }).select('id').single()
    studentId = stu!.id
  })

  it('öğretmen kendi ödevinin teslim durumunu güncelleyebilir', async () => {
    const result = await HomeworkService.updateSubmissionStatus(hwId, studentId, 'yapildi')
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('geçersiz ödev ID ile hata döner', async () => {
    const result = await HomeworkService.updateSubmissionStatus(
      '00000000-0000-0000-0000-000000000000',
      studentId,
      'yapildi'
    )
    expect(result.error).toBeTruthy()
  })
})
