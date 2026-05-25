import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'
import type { GradeColumn, GradeEntry } from '@/src/domains/grades/types'

const SCHOOL_GRADES_PERMS: GrantedPermission[] = [
  ...MUDUR_PERMS,
  { resource: 'grades', action: 'read',   scope: 'school', source: 'role' },
  { resource: 'grades', action: 'create', scope: 'school', source: 'role' },
  { resource: 'grades', action: 'update', scope: 'school', source: 'role' },
  { resource: 'grades', action: 'delete', scope: 'school', source: 'role' },
]

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility:     vi.fn(),
  requireAbility: vi.fn(),
}))

vi.mock('@/src/domains/grades/repositories/GradeRepository', () => ({
  GradeRepository: {
    findColumnsByClass:  vi.fn(),
    insertColumn:        vi.fn(),
    deleteColumn:        vi.fn(),
    findColumnOwner:     vi.fn(),
    findEntriesByClass:  vi.fn(),
    upsertEntry:         vi.fn(),
    updateColumn:        vi.fn(),
  },
}))

const { getAbility }        = await import('@/src/shared/authorization/server')
const { GradeRepository }   = await import('@/src/domains/grades/repositories/GradeRepository')
const { GradeService }      = await import('@/src/domains/grades/services/GradeService')

const SCHOOL_ID   = 'school-grade-unit'
const TEACHER_ID  = 'teacher-grade-unit'
const OTHER_ID    = 'other-teacher-unit'
const CLASS_ID    = 'class-grade-unit'
const COLUMN_ID   = 'col-1'

function makeAbility(perms: GrantedPermission[] = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

const COLUMN_DATA = {
  class_id:   CLASS_ID,
  title:      'Yazılı 1',
  grade_type: 'yazili' as const,
  max_score:  100,
  exam_date:  '2026-03-15',
}

const MOCK_COLUMN: GradeColumn = {
  id:         COLUMN_ID,
  teacher_id: TEACHER_ID,
  class_id:   CLASS_ID,
  school_id:  SCHOOL_ID,
  title:      'Yazılı 1',
  grade_type: 'yazili',
  max_score:  100,
  exam_date:  '2026-03-15',
  created_at: '2026-03-01T00:00:00Z',
}

const MOCK_ENTRY: GradeEntry = {
  id:              'entry-1',
  grade_column_id: COLUMN_ID,
  student_id:      'student-1',
  school_id:       SCHOOL_ID,
  score:           85,
  updated_at:      '2026-03-15T00:00:00Z',
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('GradeService.getColumns()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await GradeService.getColumns(CLASS_ID)
    expect(result.error).toBe('Giriş gerekli')
    expect(GradeRepository.findColumnsByClass).not.toHaveBeenCalled()
  })

  it('grades:read izni yoksa → { error: "Bu işlem için yetkiniz yok." }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await GradeService.getColumns(CLASS_ID)
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('yetki varsa sütunlar döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.findColumnsByClass).mockResolvedValue({
      data: [MOCK_COLUMN], error: null,
    } as never)
    const result = await GradeService.getColumns(CLASS_ID)
    expect(result.error).toBeUndefined()
    expect(result.data).toEqual([MOCK_COLUMN])
    expect(GradeRepository.findColumnsByClass).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID)
  })

  it('DB hatası varsa error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.findColumnsByClass).mockResolvedValue({
      data: null, error: { message: 'Bağlantı hatası' },
    } as never)
    const result = await GradeService.getColumns(CLASS_ID)
    expect(result.error).toBe('Bağlantı hatası')
  })
})

// ─────────────────────────────────────────────────────────────
describe('GradeService.addColumn()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await GradeService.addColumn(COLUMN_DATA)
    expect(result.error).toBe('Giriş gerekli')
    expect(GradeRepository.insertColumn).not.toHaveBeenCalled()
  })

  it('grades:create izni yoksa → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await GradeService.addColumn(COLUMN_DATA)
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
    expect(GradeRepository.insertColumn).not.toHaveBeenCalled()
  })

  it('yetki varsa sütun oluşturulur', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.insertColumn).mockResolvedValue({
      data: MOCK_COLUMN, error: null,
    } as never)
    const result = await GradeService.addColumn(COLUMN_DATA)
    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(MOCK_COLUMN)
    expect(GradeRepository.insertColumn).toHaveBeenCalledWith(
      expect.objectContaining({ teacher_id: TEACHER_ID, school_id: SCHOOL_ID, title: 'Yazılı 1' })
    )
  })

  it('DB hatası varsa error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.insertColumn).mockResolvedValue({
      data: null, error: { message: 'unique violation' },
    } as never)
    const result = await GradeService.addColumn(COLUMN_DATA)
    expect(result.error).toBe('unique violation')
  })
})

// ─────────────────────────────────────────────────────────────
describe('GradeService.deleteColumn()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await GradeService.deleteColumn(COLUMN_ID)
    expect(result.error).toBe('Giriş gerekli')
  })

  it('grades:delete izni yoksa → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await GradeService.deleteColumn(COLUMN_ID)
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('sütun bulunamazsa → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.findColumnOwner).mockResolvedValue({
      data: null, error: null,
    } as never)
    const result = await GradeService.deleteColumn(COLUMN_ID)
    expect(result.error).toBe('Sütun bulunamadı')
  })

  it('başkasının sütunu — own scope → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.findColumnOwner).mockResolvedValue({
      data: { teacher_id: OTHER_ID }, error: null,
    } as never)
    const result = await GradeService.deleteColumn(COLUMN_ID)
    expect(result.error).toBe('Bu sütun için yetkiniz yok')
    expect(GradeRepository.deleteColumn).not.toHaveBeenCalled()
  })

  it('kendi sütunu — own scope → silinir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.findColumnOwner).mockResolvedValue({
      data: { teacher_id: TEACHER_ID }, error: null,
    } as never)
    vi.mocked(GradeRepository.deleteColumn).mockResolvedValue({ error: null } as never)
    const result = await GradeService.deleteColumn(COLUMN_ID)
    expect(result.error).toBeUndefined()
    expect(GradeRepository.deleteColumn).toHaveBeenCalledWith(COLUMN_ID, TEACHER_ID, SCHOOL_ID)
  })

  it('school-scope yönetici başkasının sütununu silebilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(SCHOOL_GRADES_PERMS) as never)
    vi.mocked(GradeRepository.findColumnOwner).mockResolvedValue({
      data: { teacher_id: OTHER_ID }, error: null,
    } as never)
    vi.mocked(GradeRepository.deleteColumn).mockResolvedValue({ error: null } as never)
    const result = await GradeService.deleteColumn(COLUMN_ID)
    expect(result.error).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
describe('GradeService.upsertScore()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await GradeService.upsertScore({ columnId: COLUMN_ID, studentId: 'stu-1', score: 85 })
    expect(result.error).toBe('Giriş gerekli')
  })

  it('grades:update izni yoksa → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await GradeService.upsertScore({ columnId: COLUMN_ID, studentId: 'stu-1', score: 85 })
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('sütun başkasına ait — own scope → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.findColumnOwner).mockResolvedValue({
      data: { teacher_id: OTHER_ID }, error: null,
    } as never)
    const result = await GradeService.upsertScore({ columnId: COLUMN_ID, studentId: 'stu-1', score: 85 })
    expect(result.error).toBe('Bu sütun için yetkiniz yok')
    expect(GradeRepository.upsertEntry).not.toHaveBeenCalled()
  })

  it('kendi sütunu → not kaydedilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.findColumnOwner).mockResolvedValue({
      data: { teacher_id: TEACHER_ID }, error: null,
    } as never)
    vi.mocked(GradeRepository.upsertEntry).mockResolvedValue({ error: null } as never)
    const result = await GradeService.upsertScore({ columnId: COLUMN_ID, studentId: 'stu-1', score: 85 })
    expect(result.error).toBeUndefined()
    expect(GradeRepository.upsertEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        grade_column_id: COLUMN_ID, student_id: 'stu-1', score: 85, school_id: SCHOOL_ID,
      })
    )
  })

  it('score null → girilmemiş olarak kaydedilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(GradeRepository.findColumnOwner).mockResolvedValue({
      data: { teacher_id: TEACHER_ID }, error: null,
    } as never)
    vi.mocked(GradeRepository.upsertEntry).mockResolvedValue({ error: null } as never)
    const result = await GradeService.upsertScore({ columnId: COLUMN_ID, studentId: 'stu-1', score: null })
    expect(result.error).toBeUndefined()
    expect(GradeRepository.upsertEntry).toHaveBeenCalledWith(
      expect.objectContaining({ score: null })
    )
  })
})
