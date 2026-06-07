/**
 * Soft delete regression testleri.
 *
 * Amaç: Gelecekte soft-delete mantığı yanlışlıkla değiştirilirse bu testlerin kırılması.
 * - deleteClass cascade: homeworks + students sınıfla birlikte silinir
 * - restoreClass cascade: homeworks + students sınıfla birlikte geri gelir
 * - deleteHomework: hard delete değil soft delete çağrılır
 * - restoreHomework: sadece school-scope yönetici yapabilir
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

const SCHOOL_HW_PERMS: GrantedPermission[] = [
  ...OGRETMEN_PERMS,
  { resource: 'homework', action: 'delete', scope: 'school', source: 'role' },
  { resource: 'homework', action: 'update', scope: 'school', source: 'role' },
]

// ── Mocklar ───────────────────────────────────────────────────

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility:     vi.fn(),
  requireAbility: vi.fn(),
}))

vi.mock('@/src/domains/classes/repositories/ClassRepository', () => ({
  ClassRepository: {
    softDeleteClass:            vi.fn(),
    restoreClass:               vi.fn(),
    softDeleteHomeworksByClass: vi.fn(),
    restoreHomeworksByClass:    vi.fn(),
    softDeleteStudentsByClass:  vi.fn(),
    restoreStudentsByClass:     vi.fn(),
    findClassInSchool:          vi.fn(),
    insertStudents:             vi.fn(),
    insertStudent:              vi.fn(),
    insertStudentNote:          vi.fn(),
    softDeleteStudent:          vi.fn(),
    restoreStudent:             vi.fn(),
    deleteStudentNote:          vi.fn(),
    findStudentInSchool:        vi.fn(),
    insertClass:                vi.fn(),
  },
}))

vi.mock('@/src/domains/homework/repositories/HomeworkRepository', () => ({
  HomeworkRepository: {
    softDeleteHomework:          vi.fn(),
    softDeleteHomeworkAsManager: vi.fn(),
    restoreHomework:             vi.fn(),
    findHomeworkTeacher:         vi.fn(),
    classExistsInSchool:         vi.fn(),
    insertHomework:              vi.fn(),
    findCurrentSubmissionStatus: vi.fn().mockResolvedValue({ data: null, error: null }),
    insertSubmissionLog:         vi.fn().mockResolvedValue({ error: null }),
    upsertSubmissionStatus:      vi.fn(),
    upsertSubmissionsStatus:     vi.fn(),
    updateHomework:              vi.fn(),
    updateHomeworkAsManager:     vi.fn(),
  },
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-unit' } } }) },
  }),
}))

const { getAbility, requireAbility } = await import('@/src/shared/authorization/server')
const { HomeworkRepository }         = await import('@/src/domains/homework/repositories/HomeworkRepository')
const { HomeworkService }            = await import('@/src/domains/homework/services/HomeworkService')
const { ClassRepository }            = await import('@/src/domains/classes/repositories/ClassRepository')
const { ClassService }               = await import('@/src/domains/classes/services/ClassService')

const SCHOOL_ID  = 'school-softdel-unit'
const TEACHER_ID = 'teacher-unit'
const CLASS_ID   = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const HW_ID      = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'

function makeAbility(perms = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('ClassService.deleteClass() — cascade soft delete', () => {
  it('sınıf silinince homeworks ve students önce soft-delete edilir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility([
      ...OGRETMEN_PERMS,
      { resource: 'classes', action: 'delete', scope: 'school', source: 'role' },
    ]) as never)

    await ClassService.deleteClass(CLASS_ID)

    // Cascade sırası: önce bağımlı kayıtlar, sonra sınıf
    expect(ClassRepository.softDeleteHomeworksByClass).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID, TEACHER_ID)
    expect(ClassRepository.softDeleteStudentsByClass).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID, TEACHER_ID)
    expect(ClassRepository.softDeleteClass).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID, TEACHER_ID)
  })

  it('deleteClass: hard delete fonksiyonu HİÇ çağrılmaz', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility([
      ...OGRETMEN_PERMS,
      { resource: 'classes', action: 'delete', scope: 'school', source: 'role' },
    ]) as never)

    await ClassService.deleteClass(CLASS_ID)

    // Sadece soft delete çağrıları yapılmalı
    expect(ClassRepository.softDeleteClass).toHaveBeenCalledOnce()
    expect(ClassRepository.softDeleteHomeworksByClass).toHaveBeenCalledOnce()
    expect(ClassRepository.softDeleteStudentsByClass).toHaveBeenCalledOnce()
  })

  it('deleteClass: P.CLASSES.DELETE izni yoksa throw eder', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS) as never)

    await expect(ClassService.deleteClass(CLASS_ID)).rejects.toThrow()
    expect(ClassRepository.softDeleteClass).not.toHaveBeenCalled()
    expect(ClassRepository.softDeleteHomeworksByClass).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
describe('ClassService.restoreClass() — cascade restore', () => {
  it('sınıf geri yüklenince students ve homeworks da geri yüklenir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility([
      ...OGRETMEN_PERMS,
      { resource: 'classes', action: 'create', scope: 'school', source: 'role' },
    ]) as never)

    await ClassService.restoreClass(CLASS_ID)

    expect(ClassRepository.restoreClass).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID)
    expect(ClassRepository.restoreStudentsByClass).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID)
    expect(ClassRepository.restoreHomeworksByClass).toHaveBeenCalledWith(CLASS_ID, SCHOOL_ID)
  })

  it('restore: P.CLASSES.CREATE izni yoksa throw eder (öğretmen restore edemez)', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS) as never)

    await expect(ClassService.restoreClass(CLASS_ID)).rejects.toThrow()
    expect(ClassRepository.restoreClass).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.deleteHomework() — soft delete', () => {
  it('own-scope: softDeleteHomework çağrılır (hard delete değil)', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS) as never)
    vi.mocked(HomeworkRepository.softDeleteHomework).mockResolvedValue({ error: null } as never)

    await HomeworkService.deleteHomework(HW_ID)

    expect(HomeworkRepository.softDeleteHomework).toHaveBeenCalledWith(HW_ID, TEACHER_ID, SCHOOL_ID)
    expect(HomeworkRepository.softDeleteHomeworkAsManager).not.toHaveBeenCalled()
  })

  it('school-scope: softDeleteHomeworkAsManager çağrılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(SCHOOL_HW_PERMS) as never)
    vi.mocked(HomeworkRepository.softDeleteHomeworkAsManager).mockResolvedValue({ error: null } as never)

    await HomeworkService.deleteHomework(HW_ID)

    expect(HomeworkRepository.softDeleteHomeworkAsManager).toHaveBeenCalledWith(HW_ID, TEACHER_ID, SCHOOL_ID)
    expect(HomeworkRepository.softDeleteHomework).not.toHaveBeenCalled()
  })

  it('silme başarısız (DB hatası) → error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS) as never)
    vi.mocked(HomeworkRepository.softDeleteHomework).mockResolvedValue({
      error: { message: 'DB hatası' },
    } as never)

    const result = await HomeworkService.deleteHomework(HW_ID)
    expect(result.error).toBe('DB hatası')
  })
})

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.restoreHomework() — sadece yönetici', () => {
  it('own-scope öğretmen restore edemez → { error }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS) as never)
    const result = await HomeworkService.restoreHomework(HW_ID)
    expect(result.error).toBeTruthy()
    expect(HomeworkRepository.restoreHomework).not.toHaveBeenCalled()
  })

  it('school-scope yönetici restore edebilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(SCHOOL_HW_PERMS) as never)
    vi.mocked(HomeworkRepository.restoreHomework).mockResolvedValue({ error: null } as never)

    const result = await HomeworkService.restoreHomework(HW_ID)
    expect(result.error).toBeUndefined()
    expect(HomeworkRepository.restoreHomework).toHaveBeenCalledWith(HW_ID, SCHOOL_ID)
  })
})
