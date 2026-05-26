import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'

vi.mock('@/src/shared/authorization/server', () => ({
  requireAbility: vi.fn(),
}))

vi.mock('@/src/queries/classes', () => ({
  insertClass:                vi.fn(),
  softDeleteClass:            vi.fn(),
  restoreClass:               vi.fn(),
  softDeleteHomeworksByClass: vi.fn(),
  restoreHomeworksByClass:    vi.fn(),
  softDeleteStudentsByClass:  vi.fn(),
  restoreStudentsByClass:     vi.fn(),
  softDeleteStudent:          vi.fn(),
  restoreStudent:             vi.fn(),
  insertStudent:              vi.fn(),
  insertStudents:             vi.fn(),
  insertStudentNote:          vi.fn(),
  deleteStudentNote:          vi.fn(),
  findClassInSchool:          vi.fn(),
  findStudentInSchool:        vi.fn(),
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-unit' } } }) },
  }),
}))

const { requireAbility }                   = await import('@/src/shared/authorization/server')
const { insertStudents, findClassInSchool } = await import('@/src/queries/classes')
const { ClassService }                     = await import('@/src/domains/classes/services/ClassService')

const SCHOOL_ID = 'school-class-unit'
const CLASS_ID  = 'class-unit-test'

function makeAbilityWithStudentCreate() {
  return createAbility({
    userId:      'teacher-unit',
    schoolId:    SCHOOL_ID,
    permissions: [
      { resource: 'students', action: 'create', scope: 'school', source: 'role' },
    ],
  })
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('ClassService.addStudentsBulk()', () => {
  beforeEach(() => {
    vi.mocked(findClassInSchool).mockResolvedValue({ data: { id: CLASS_ID }, error: null } as never)
  })

  it('101 öğrenci → auth çağrılmadan hata fırlatır', async () => {
    const students = Array.from({ length: 101 }, (_, i) => ({
      full_name: `Öğrenci ${i}`, student_number: null,
    }))
    await expect(ClassService.addStudentsBulk(CLASS_ID, students))
      .rejects.toThrow('En fazla 100 öğrenci eklenebilir')
    expect(requireAbility).not.toHaveBeenCalled()
  })

  it('kısa isimler (< 2 karakter) filtrelenir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(insertStudents).mockResolvedValue(undefined as never)

    await ClassService.addStudentsBulk(CLASS_ID, [
      { full_name: 'X',   student_number: null },
      { full_name: 'Ali', student_number: null },
    ])

    const inserted = vi.mocked(insertStudents).mock.calls[0][0]
    expect(inserted).toHaveLength(1)
    expect(inserted[0].full_name).toBe('Ali')
  })

  it('sadece boşluktan oluşan isimler filtrelenir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(insertStudents).mockResolvedValue(undefined as never)

    await ClassService.addStudentsBulk(CLASS_ID, [
      { full_name: '   ', student_number: null },
    ])

    const inserted = vi.mocked(insertStudents).mock.calls[0][0]
    expect(inserted).toHaveLength(0)
  })

  it('isimler trim edilir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(insertStudents).mockResolvedValue(undefined as never)

    await ClassService.addStudentsBulk(CLASS_ID, [
      { full_name: '  Mehmet Ali  ', student_number: null },
    ])

    const inserted = vi.mocked(insertStudents).mock.calls[0][0]
    expect(inserted[0].full_name).toBe('Mehmet Ali')
  })

  it('isimler 120 karaktere kırpılır', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(insertStudents).mockResolvedValue(undefined as never)

    await ClassService.addStudentsBulk(CLASS_ID, [
      { full_name: 'A'.repeat(150), student_number: null },
    ])

    const inserted = vi.mocked(insertStudents).mock.calls[0][0]
    expect(inserted[0].full_name).toHaveLength(120)
  })

  it('student_number 20 karaktere kırpılır', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(insertStudents).mockResolvedValue(undefined as never)

    await ClassService.addStudentsBulk(CLASS_ID, [
      { full_name: 'Ali Veli', student_number: '1'.repeat(30) },
    ])

    const inserted = vi.mocked(insertStudents).mock.calls[0][0]
    expect(inserted[0].student_number).toHaveLength(20)
  })

  it('null student_number null olarak korunur', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(insertStudents).mockResolvedValue(undefined as never)

    await ClassService.addStudentsBulk(CLASS_ID, [
      { full_name: 'Ali Veli', student_number: null },
    ])

    const inserted = vi.mocked(insertStudents).mock.calls[0][0]
    expect(inserted[0].student_number).toBeNull()
  })

  it('her satıra school_id ve class_id eklenir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(insertStudents).mockResolvedValue(undefined as never)

    await ClassService.addStudentsBulk(CLASS_ID, [
      { full_name: 'Test Öğrenci', student_number: '001' },
    ])

    const inserted = vi.mocked(insertStudents).mock.calls[0][0]
    expect(inserted[0].class_id).toBe(CLASS_ID)
    expect(inserted[0].school_id).toBe(SCHOOL_ID)
  })

  it('100 öğrenci (sınır) kabul edilir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(insertStudents).mockResolvedValue(undefined as never)

    const students = Array.from({ length: 100 }, (_, i) => ({
      full_name: `Öğrenci ${i + 1}`, student_number: null,
    }))
    await expect(ClassService.addStudentsBulk(CLASS_ID, students)).resolves.not.toThrow()
  })
})
