import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

// Okul genelinde homework yetkisi olan yönetici (gerçek DB'deki müdür rolü gibi)
const SCHOOL_HW_PERMS: GrantedPermission[] = [
  ...OGRETMEN_PERMS,
  { resource: 'homework', action: 'update', scope: 'school', source: 'role' },
  { resource: 'homework', action: 'delete', scope: 'school', source: 'role' },
]

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility:     vi.fn(),
  requireAbility: vi.fn(),
}))

vi.mock('@/src/domains/homework/repositories/HomeworkRepository', () => ({
  HomeworkRepository: {
    insertHomework:               vi.fn(),
    findHomeworkTeacher:          vi.fn(),
    upsertSubmissionStatus:       vi.fn(),
    upsertSubmissionsStatus:      vi.fn(),
    upsertSubmissionNote:         vi.fn(),
    softDeleteHomework:           vi.fn(),
    softDeleteHomeworkAsManager:  vi.fn(),
    restoreHomework:              vi.fn(),
  },
}))

const { getAbility }           = await import('@/src/shared/authorization/server')
const { HomeworkRepository }   = await import('@/src/domains/homework/repositories/HomeworkRepository')
const { HomeworkService }      = await import('@/src/domains/homework/services/HomeworkService')

const SCHOOL_ID  = 'school-hw-unit'
const TEACHER_ID = 'teacher-unit'
const OTHER_ID   = 'other-teacher'

function makeAbility(perms = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

const HW_DATA = {
  class_id: 'cls-1', title: 'Test Ödevi',
  description: null, subject: 'Matematik', due_date: '2026-12-31',
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.createHomework()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await HomeworkService.createHomework(HW_DATA)
    expect(result.error).toBe('Giriş gerekli')
    expect(HomeworkRepository.insertHomework).not.toHaveBeenCalled()
  })

  it('homework:create izni yoksa → { error: "Bu işlem için yetkiniz yok." }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await HomeworkService.createHomework(HW_DATA)
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
    expect(HomeworkRepository.insertHomework).not.toHaveBeenCalled()
  })

  it('yetki varsa ödev oluşturulur', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.insertHomework).mockResolvedValue({ error: null } as never)
    const result = await HomeworkService.createHomework(HW_DATA)
    expect(result.error).toBeUndefined()
    expect(HomeworkRepository.insertHomework).toHaveBeenCalledWith(
      expect.objectContaining({ teacher_id: TEACHER_ID, school_id: SCHOOL_ID, title: 'Test Ödevi' })
    )
  })

  it('DB hatası varsa error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.insertHomework).mockResolvedValue({
      error: { message: 'DB bağlantı hatası' },
    } as never)
    const result = await HomeworkService.createHomework(HW_DATA)
    expect(result.error).toBe('DB bağlantı hatası')
  })
})

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.updateSubmissionStatus()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi')
    expect(result.error).toBe('Giriş gerekli')
  })

  it('homework:update izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi')
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('ödev bulunamazsa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({ data: null, error: null } as never)
    const result = await HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi')
    expect(result.error).toBe('Ödev bulunamadı')
  })

  it('başkasının ödevi — own scope → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: { teacher_id: OTHER_ID }, error: null,
    } as never)
    const result = await HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi')
    expect(result.error).toBe('Bu ödev için yetkiniz yok')
    expect(HomeworkRepository.upsertSubmissionStatus).not.toHaveBeenCalled()
  })

  it('kendi ödevi → güncellenir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: { teacher_id: TEACHER_ID }, error: null,
    } as never)
    vi.mocked(HomeworkRepository.upsertSubmissionStatus).mockResolvedValue({ error: null } as never)
    const result = await HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi')
    expect(result.success).toBe(true)
  })

  it('school-scope (müdür) başkasının ödevini güncelleyebilir', async () => {
    const mudurAbility = makeAbility(SCHOOL_HW_PERMS)
    vi.mocked(getAbility).mockResolvedValue(mudurAbility as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: { teacher_id: OTHER_ID }, error: null,
    } as never)
    vi.mocked(HomeworkRepository.upsertSubmissionStatus).mockResolvedValue({ error: null } as never)
    const result = await HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi')
    expect(result.success).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.deleteHomework()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    expect((await HomeworkService.deleteHomework('hw-1')).error).toBe('Giriş gerekli')
  })

  it('own-scope öğretmen → softDeleteHomework çağrılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.softDeleteHomework).mockResolvedValue({ error: null } as never)
    const result = await HomeworkService.deleteHomework('hw-1')
    expect(result.error).toBeUndefined()
    expect(HomeworkRepository.softDeleteHomework).toHaveBeenCalled()
    expect(HomeworkRepository.softDeleteHomeworkAsManager).not.toHaveBeenCalled()
  })

  it('school-scope yönetici → softDeleteHomeworkAsManager çağrılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(SCHOOL_HW_PERMS) as never)
    vi.mocked(HomeworkRepository.softDeleteHomeworkAsManager).mockResolvedValue({ error: null } as never)
    const result = await HomeworkService.deleteHomework('hw-1')
    expect(result.error).toBeUndefined()
    expect(HomeworkRepository.softDeleteHomeworkAsManager).toHaveBeenCalled()
    expect(HomeworkRepository.softDeleteHomework).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.restoreHomework()', () => {
  it('giriş yapılmamış → erken dönüş', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await HomeworkService.restoreHomework('hw-1')
    expect(HomeworkRepository.restoreHomework).not.toHaveBeenCalled()
  })

  it('own-scope öğretmen restore edemez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    await HomeworkService.restoreHomework('hw-1')
    expect(HomeworkRepository.restoreHomework).not.toHaveBeenCalled()
  })

  it('school-scope yönetici restore edebilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(SCHOOL_HW_PERMS) as never)
    vi.mocked(HomeworkRepository.restoreHomework).mockResolvedValue({ data: null, error: null } as never)
    await HomeworkService.restoreHomework('hw-1')
    expect(HomeworkRepository.restoreHomework).toHaveBeenCalledWith('hw-1', SCHOOL_ID)
  })
})
