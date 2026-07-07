/**
 * Tenant isolation regression testleri.
 *
 * Amaç: school_id filtreleri yanlışlıkla silinirse veya ability.schoolId yerine
 * başka bir değer kullanılırsa bu testlerin kırılmasını sağlamak.
 *
 * Her test: "X işlemi yalnızca mevcut tenant verilerini etkiler" varsayımını korur.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'

// ── Ortak mocklar ─────────────────────────────────────────────

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility:     vi.fn(),
  requireAbility: vi.fn(),
}))

vi.mock('@/src/domains/homework/repositories/HomeworkRepository', () => ({
  HomeworkRepository: {
    insertHomework:              vi.fn(),
    findHomeworkTeacher:         vi.fn(),
    classExistsInSchool:         vi.fn(),
    upsertSubmissionStatus:      vi.fn(),
    findCurrentSubmissionStatus: vi.fn().mockResolvedValue({ data: null, error: null }),
    insertSubmissionLog:         vi.fn().mockResolvedValue({ error: null }),
  },
}))

vi.mock('@/src/domains/classes/repositories/ClassRepository', () => ({
  ClassRepository: {
    // Yazma metodları PostgrestResponse ({ error }) döndürür; servis artık error kontrol ediyor
    findClassInSchool:          vi.fn(),
    findStudentInSchool:        vi.fn(),
    insertStudent:              vi.fn().mockResolvedValue({ error: null }),
    insertStudentNote:          vi.fn().mockResolvedValue({ error: null }),
    insertClass:                vi.fn().mockResolvedValue({ error: null }),
    softDeleteClassCascade:     vi.fn().mockResolvedValue({ error: null }),
    restoreClassCascade:        vi.fn().mockResolvedValue({ error: null }),
    insertStudents:             vi.fn().mockResolvedValue({ error: null }),
  },
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-unit' } } }) },
  }),
}))

const { getAbility, requireAbility }  = await import('@/src/shared/authorization/server')
const { HomeworkRepository }          = await import('@/src/domains/homework/repositories/HomeworkRepository')
const { HomeworkService }             = await import('@/src/domains/homework/services/HomeworkService')
const { ClassRepository }             = await import('@/src/domains/classes/repositories/ClassRepository')
const { ClassService }                = await import('@/src/domains/classes/services/ClassService')
const { findClassInSchool, findStudentInSchool, insertStudent, insertStudents } = ClassRepository

// ── Sabitler ─────────────────────────────────────────────────
const MY_SCHOOL    = 'my-school-id'
const OTHER_SCHOOL = 'other-school-id'
const TEACHER_ID   = 'teacher-unit'
const CLASS_ID     = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const STUDENT_ID   = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'

function makeAbility(perms = OGRETMEN_PERMS, schoolId = MY_SCHOOL) {
  return createAbility({ userId: TEACHER_ID, schoolId, permissions: perms })
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('HomeworkService — tenant isolation', () => {
  it('createHomework: school_id ability\'den alınır, dışarıdan enjekte edilemez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.insertHomework).mockResolvedValue({ error: null } as never)

    await HomeworkService.createHomework({
      class_id: CLASS_ID, title: 'Test', description: null, subject: 'Mat', due_date: '2099-01-01',
    })

    const callArgs = vi.mocked(HomeworkRepository.insertHomework).mock.calls[0][0]
    expect(callArgs.school_id).toBe(MY_SCHOOL)
    expect(callArgs.teacher_id).toBe(TEACHER_ID)
    // Caller'ın ability'si dışında bir school_id kullanılmadığını doğrula
    expect(callArgs.school_id).not.toBe(OTHER_SCHOOL)
  })

  it('updateSubmissionStatus: ödev başka okula aitse bulunamadı döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    // Başka okulun ödevini MY_SCHOOL ile arıyoruz — null dönmeli
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({ data: null, error: null } as never)

    const result = await HomeworkService.updateSubmissionStatus(
      'hw-other-school', 'student-1', 'yapildi'
    )

    expect(result.error).toBe('Ödev bulunamadı')
    expect(HomeworkRepository.upsertSubmissionStatus).not.toHaveBeenCalled()
  })

  it('createHomework: insertHomework çağrısında MY_SCHOOL school_id\'si geçilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.insertHomework).mockResolvedValue({ data: { id: 'hw-1' }, error: null } as never)

    await HomeworkService.createHomework({
      class_id: CLASS_ID, title: 'Test', description: null, subject: 'Mat', due_date: null,
    })

    expect(HomeworkRepository.insertHomework).toHaveBeenCalledWith(
      expect.objectContaining({ school_id: MY_SCHOOL })
    )
  })
})

// ─────────────────────────────────────────────────────────────
describe('ClassService — tenant isolation', () => {
  it('addStudent: sınıf başka okula aitse → throw Sınıf bulunamadı', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility([
      ...OGRETMEN_PERMS,
      { resource: 'students', action: 'create', scope: 'school', source: 'role' },
    ]) as never)
    vi.mocked(findClassInSchool).mockResolvedValue({ data: null, error: null } as never)

    await expect(
      ClassService.addStudent(CLASS_ID, { full_name: 'Test Öğrenci', student_number: null })
    ).rejects.toThrow('Sınıf bulunamadı')

    expect(findClassInSchool).toHaveBeenCalledWith(CLASS_ID, MY_SCHOOL)
  })

  it('addStudent: findClassInSchool ability.schoolId ile çağrılır', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility([
      ...OGRETMEN_PERMS,
      { resource: 'students', action: 'create', scope: 'school', source: 'role' },
    ]) as never)
    vi.mocked(findClassInSchool).mockResolvedValue({ data: { id: CLASS_ID }, error: null } as never)
    vi.mocked(insertStudent).mockResolvedValue({ error: null } as never)

    await ClassService.addStudent(CLASS_ID, { full_name: 'Ali Veli', student_number: null })

    expect(findClassInSchool).toHaveBeenCalledWith(CLASS_ID, MY_SCHOOL)
    expect(findClassInSchool).not.toHaveBeenCalledWith(CLASS_ID, OTHER_SCHOOL)
  })

  it('addStudentNote: öğrenci başka okula aitse → throw Öğrenci bulunamadı', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility([
      ...OGRETMEN_PERMS,
      { resource: 'notes', action: 'create', scope: 'own', source: 'role' },
    ]) as never)
    vi.mocked(findStudentInSchool).mockResolvedValue({ data: null, error: null } as never)

    await expect(
      ClassService.addStudentNote(STUDENT_ID, { body: 'Not' })
    ).rejects.toThrow('Öğrenci bulunamadı')

    expect(findStudentInSchool).toHaveBeenCalledWith(STUDENT_ID, MY_SCHOOL)
  })

  it('addStudentsBulk: tüm kayıtlar ability.schoolId ile eklenir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility([
      { resource: 'students', action: 'create', scope: 'school', source: 'role' },
    ]) as never)
    vi.mocked(findClassInSchool).mockResolvedValue({ data: { id: CLASS_ID }, error: null } as never)
    vi.mocked(insertStudents).mockResolvedValue({ error: null } as never)

    await ClassService.addStudentsBulk(CLASS_ID, [
      { full_name: 'Ali Veli', student_number: null },
    ])

    const inserted = vi.mocked(insertStudents).mock.calls[0][0] as { school_id: string }[]
    expect(inserted[0].school_id).toBe(MY_SCHOOL)
    expect(inserted[0].school_id).not.toBe(OTHER_SCHOOL)
  })
})
