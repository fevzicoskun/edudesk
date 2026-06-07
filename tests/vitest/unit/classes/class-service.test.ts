import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'

vi.mock('@/src/shared/authorization/server', () => ({
  requireAbility: vi.fn(),
}))

vi.mock('@/src/domains/classes/repositories/ClassRepository', () => ({
  ClassRepository: {
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
  },
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-unit' } } }) },
  }),
}))

const { requireAbility }     = await import('@/src/shared/authorization/server')
const { ClassRepository }    = await import('@/src/domains/classes/repositories/ClassRepository')
const { ClassService }       = await import('@/src/domains/classes/services/ClassService')

const { insertStudents, findClassInSchool, insertClass, softDeleteClass, softDeleteHomeworksByClass, softDeleteStudentsByClass, insertStudent } = ClassRepository

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

// ─────────────────────────────────────────────────────────────
describe('ClassService.createClass()', () => {
  function makeAbilityWithClassCreate() {
    return createAbility({
      userId:   'teacher-unit',
      schoolId: SCHOOL_ID,
      permissions: [{ resource: 'classes', action: 'create', scope: 'school', source: 'role' }],
    })
  }

  it('classes:create izni yoksa → throw', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    await expect(ClassService.createClass({ name: '10-A', grade: 10 })).rejects.toThrow()
    expect(insertClass).not.toHaveBeenCalled()
  })

  it('yetkili kullanıcı sınıf oluşturur → insertClass çağrılır', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithClassCreate() as never)
    vi.mocked(insertClass).mockResolvedValue({ error: null } as never)

    await ClassService.createClass({ name: '10-A', grade: 10 })

    expect(insertClass).toHaveBeenCalledWith(
      expect.objectContaining({
        name:      '10-A',
        grade:     10,
        school_id: SCHOOL_ID,
      })
    )
  })

  it('DB hatası varsa throw eder', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithClassCreate() as never)
    vi.mocked(insertClass).mockResolvedValue({ error: { message: 'unique violation' } } as never)

    await expect(ClassService.createClass({ name: '10-A', grade: 10 })).rejects.toThrow('unique violation')
  })
})

// ─────────────────────────────────────────────────────────────
describe('ClassService.deleteClass()', () => {
  function makeAbilityWithClassDelete() {
    return createAbility({
      userId:   'teacher-unit',
      schoolId: SCHOOL_ID,
      permissions: [{ resource: 'classes', action: 'delete', scope: 'school', source: 'role' }],
    })
  }

  it('classes:delete izni yoksa → throw, cascade çağrılmaz', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    await expect(ClassService.deleteClass(CLASS_ID)).rejects.toThrow()
    expect(softDeleteClass).not.toHaveBeenCalled()
    expect(softDeleteHomeworksByClass).not.toHaveBeenCalled()
    expect(softDeleteStudentsByClass).not.toHaveBeenCalled()
  })

  it('yetkili kullanıcı cascade soft-delete yapar', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithClassDelete() as never)
    vi.mocked(softDeleteHomeworksByClass).mockResolvedValue(undefined as never)
    vi.mocked(softDeleteStudentsByClass).mockResolvedValue(undefined as never)
    vi.mocked(softDeleteClass).mockResolvedValue(undefined as never)

    await ClassService.deleteClass(CLASS_ID)

    expect(softDeleteHomeworksByClass).toHaveBeenCalledOnce()
    expect(softDeleteStudentsByClass).toHaveBeenCalledOnce()
    expect(softDeleteClass).toHaveBeenCalledOnce()
  })
})

// ─────────────────────────────────────────────────────────────
describe('ClassService.addStudent()', () => {
  it('students:create izni yoksa → throw', async () => {
    vi.mocked(requireAbility).mockResolvedValue(createAbility({
      userId: 'teacher-unit', schoolId: SCHOOL_ID, permissions: [],
    }) as never)

    await expect(ClassService.addStudent(CLASS_ID, { full_name: 'Ali', student_number: null })).rejects.toThrow()
    expect(insertStudent).not.toHaveBeenCalled()
  })

  it('sınıf okula ait değilse → throw Sınıf bulunamadı', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(findClassInSchool).mockResolvedValue({ data: null, error: null } as never)

    await expect(ClassService.addStudent(CLASS_ID, { full_name: 'Ali', student_number: null }))
      .rejects.toThrow('Sınıf bulunamadı')

    expect(insertStudent).not.toHaveBeenCalled()
  })

  it('geçerli sınıf + yetki → insertStudent çağrılır', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentCreate() as never)
    vi.mocked(findClassInSchool).mockResolvedValue({ data: { id: CLASS_ID }, error: null } as never)
    vi.mocked(insertStudent).mockResolvedValue(undefined as never)

    await ClassService.addStudent(CLASS_ID, { full_name: 'Ali Veli', student_number: '123' })

    expect(insertStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        class_id:  CLASS_ID,
        school_id: SCHOOL_ID,
        full_name: 'Ali Veli',
      })
    )
  })
})

// ─── updateVeliContact — RBAC güvenlik fix ──────────────────
// students:update izni olmadan veli bilgisi güncellenememeli.

const { createClient } = await import('@/src/infrastructure/supabase/server')

describe('ClassService.updateVeliContact()', () => {
  function makeAbilityWithStudentUpdate() {
    return createAbility({
      userId:      'teacher-unit',
      schoolId:    SCHOOL_ID,
      permissions: [
        { resource: 'students', action: 'update', scope: 'school', source: 'role' },
      ],
    })
  }

  it('students:update izni yoksa → throw, DB çağrılmaz', async () => {
    vi.mocked(requireAbility).mockResolvedValue(createAbility({
      userId: 'teacher-unit', schoolId: SCHOOL_ID, permissions: [],
    }) as never)

    await expect(
      ClassService.updateVeliContact('stu-1', { email: 'a@b.com', telefon: null, ad: 'Veli' })
    ).rejects.toThrow()

    expect(createClient).not.toHaveBeenCalled()
  })

  it('yetkili kullanıcı → supabase update çağrılır, school_id filtresi uygulanır', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbilityWithStudentUpdate() as never)

    const chain: Record<string, unknown> = {}
    chain.then  = (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r)
    chain.catch = () => Promise.resolve({ error: null })
    for (const m of ['update','eq','from']) chain[m] = vi.fn().mockReturnValue(chain)
    const db = { from: vi.fn().mockReturnValue(chain) }
    vi.mocked(createClient).mockResolvedValue(db as never)

    const result = await ClassService.updateVeliContact('stu-1', { email: 'a@b.com', telefon: null, ad: 'Veli' })

    expect(result).toEqual({})
    expect(db.from).toHaveBeenCalledWith('students')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ veli_email: 'a@b.com' })
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 'stu-1')
    expect(chain.eq).toHaveBeenCalledWith('school_id', SCHOOL_ID)
  })
})
