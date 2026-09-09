import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

vi.mock('@/src/shared/authorization/server', () => ({ requireAbility: vi.fn(), getAbility: vi.fn() }))
vi.mock('@/src/shared/auth', () => ({ getCurrentProfile: vi.fn() }))
vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/src/domains/studyPlan/repositories/StudyPlanRepository', () => ({
  StudyPlanRepository: {
    studentClassId:      vi.fn(),
    isTeacherOfClass:    vi.fn(),
    listStudentsOfClass: vi.fn(),
    listTeacherItems:    vi.fn(),
    listStudentItems:    vi.fn(),
    listSources:         vi.fn(),
    insertSource:        vi.fn(),
    findSourceStudentId: vi.fn(),
    deactivateSource:    vi.fn(),
    insertItems:         vi.fn(),
    updateItem:          vi.fn(),
    deleteItem:          vi.fn(),
  },
}))

const { requireAbility }     = await import('@/src/shared/authorization/server')
const { getCurrentProfile }  = await import('@/src/shared/auth')
const { StudyPlanRepository } = await import('@/src/domains/studyPlan/repositories/StudyPlanRepository')
const { StudyPlanService }   = await import('@/src/domains/studyPlan/services/StudyPlanService')

const SCHOOL = 'school-1', TEACHER = 'teacher-1', STUDENT = 'student-1', CLASS = 'class-1'
const NO_WRITE: GrantedPermission[] = OGRETMEN_PERMS.filter(p => !(p.resource === 'homework' && p.action !== 'read'))

function ability(perms = OGRETMEN_PERMS, userId = TEACHER) {
  return createAbility({ userId, schoolId: SCHOOL, permissions: perms })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAbility).mockResolvedValue(ability())
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: TEACHER, subject: 'Matematik', role: 'ogretmen', school_id: SCHOOL, full_name: 'T' } as never)
  vi.mocked(StudyPlanRepository.studentClassId).mockResolvedValue({ data: { class_id: CLASS }, error: null } as never)
  vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(true)
  vi.mocked(StudyPlanRepository.insertItems).mockResolvedValue({ data: [{ id: 'item-1' }], error: null } as never)
  vi.mocked(StudyPlanRepository.updateItem).mockResolvedValue({ data: [{ id: 'item-1' }], error: null } as never)
  vi.mocked(StudyPlanRepository.deleteItem).mockResolvedValue({ data: [{ id: 'item-1' }], error: null } as never)
  vi.mocked(StudyPlanRepository.listTeacherItems).mockResolvedValue({ data: [], error: null } as never)
  vi.mocked(StudyPlanRepository.findSourceStudentId).mockResolvedValue({ data: { student_id: STUDENT }, error: null } as never)
  vi.mocked(StudyPlanRepository.deactivateSource).mockResolvedValue({ data: [{ id: 'src-1' }], error: null } as never)
})

describe('StudyPlanService.addItem', () => {
  it('teacher_id/school_id/subject ability ve profilden yazılır', async () => {
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: 'Apotemi', description: 'Türev 40 soru' })
    expect(r).toEqual({ id: 'item-1' })
    expect(StudyPlanRepository.insertItems).toHaveBeenCalledWith([expect.objectContaining({
      teacher_id: TEACHER, school_id: SCHOOL, student_id: STUDENT, subject: 'Matematik',
      week_start: '2026-09-07', status: 'planlandi',
    })])
  })
  it('profil subject null → Genel', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: TEACHER, subject: null } as never)
    await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: null, description: 'x' })
    expect(StudyPlanRepository.insertItems).toHaveBeenCalledWith([expect.objectContaining({ subject: 'Genel' })])
  })
  it('homework.create izni yoksa reddeder', async () => {
    vi.mocked(requireAbility).mockResolvedValue(ability(NO_WRITE))
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: null, description: 'x' })
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
    expect(StudyPlanRepository.insertItems).not.toHaveBeenCalled()
  })
  it('öğrencinin sınıfı teacher_classes dışındaysa reddeder (müdür bile olsa)', async () => {
    vi.mocked(requireAbility).mockResolvedValue(ability(MUDUR_PERMS, 'mudur-1'))
    vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(false)
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: null, description: 'x' })
    expect(r.error).toBe('Bu öğrencinin sınıfına atanmış değilsiniz.')
  })
  it('plan_date hafta dışındaysa reddeder', async () => {
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: '2026-09-14', source: null, description: 'x' })
    expect(r.error).toBe('Gün seçilen haftanın içinde olmalı.')
  })
  it('öğrenci başka okulda/silinmişse reddeder', async () => {
    vi.mocked(StudyPlanRepository.studentClassId).mockResolvedValue({ data: null, error: null } as never)
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: null, description: 'x' })
    expect(r.error).toBe('Öğrenci bulunamadı.')
  })
})

describe('StudyPlanService.updateItem / deleteItem', () => {
  it('yalnız kendi maddesi: repo teacherId ile kısıtlanır, 0 satır → hata', async () => {
    vi.mocked(StudyPlanRepository.updateItem).mockResolvedValue({ data: [], error: null } as never)
    const r = await StudyPlanService.updateItem('item-9', { status: 'yapildi' })
    expect(StudyPlanRepository.updateItem).toHaveBeenCalledWith('item-9', TEACHER, SCHOOL, { status: 'yapildi' })
    expect(r.error).toBe('Madde bulunamadı veya size ait değil.')
  })
  it('update izni yoksa reddeder', async () => {
    vi.mocked(requireAbility).mockResolvedValue(ability(NO_WRITE))
    const r = await StudyPlanService.updateItem('item-1', { note: 'n' })
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
  })
  it('delete 0 satır → hata', async () => {
    vi.mocked(StudyPlanRepository.deleteItem).mockResolvedValue({ data: [], error: null } as never)
    const r = await StudyPlanService.deleteItem('item-9')
    expect(r.error).toBe('Madde bulunamadı veya size ait değil.')
  })
})

describe('StudyPlanService.copyPreviousWeek', () => {
  it('hedef hafta doluysa hata', async () => {
    vi.mocked(StudyPlanRepository.listTeacherItems).mockResolvedValueOnce({ data: [{ id: 'x' }], error: null } as never)
    const r = await StudyPlanService.copyPreviousWeek(STUDENT, '2026-09-14')
    expect(r.error).toBe('Bu hafta boş değil.')
  })
  it('önceki hafta boşsa hata', async () => {
    vi.mocked(StudyPlanRepository.listTeacherItems)
      .mockResolvedValueOnce({ data: [], error: null } as never)   // hedef
      .mockResolvedValueOnce({ data: [], error: null } as never)   // kaynak
    const r = await StudyPlanService.copyPreviousWeek(STUDENT, '2026-09-14')
    expect(r.error).toBe('Geçen hafta plan yok.')
  })
  it('kopyalar: tarih kayar, durum sıfırlanır, count döner', async () => {
    vi.mocked(StudyPlanRepository.listTeacherItems)
      .mockResolvedValueOnce({ data: [], error: null } as never)
      .mockResolvedValueOnce({ data: [
        { plan_date: '2026-09-09', source: 'A', description: 'd', subject: 'Matematik', status: 'yapildi', note: 'n' },
      ], error: null } as never)
    vi.mocked(StudyPlanRepository.insertItems).mockResolvedValue({ data: [{ id: 'new-1' }], error: null } as never)
    const r = await StudyPlanService.copyPreviousWeek(STUDENT, '2026-09-14')
    expect(r).toEqual({ count: 1 })
    expect(StudyPlanRepository.insertItems).toHaveBeenCalledWith([expect.objectContaining({
      plan_date: '2026-09-16', status: 'planlandi', note: null, week_start: '2026-09-14', teacher_id: TEACHER,
    })])
  })
})

describe('StudyPlanService okuma', () => {
  it('getClassWeek: öğrencileri maddeleriyle eşler; sınıf dışı öğretmene boş+hata', async () => {
    vi.mocked(StudyPlanRepository.listStudentsOfClass).mockResolvedValue({ data: [
      { id: 's1', full_name: 'Ali', student_number: '1' }, { id: 's2', full_name: 'Ayşe', student_number: '2' },
    ], error: null } as never)
    vi.mocked(StudyPlanRepository.listTeacherItems).mockResolvedValue({ data: [
      { id: 'i1', student_id: 's2', teacher_id: TEACHER, subject: 'Matematik', week_start: '2026-09-07', plan_date: null, source: null, description: 'd', status: 'planlandi', note: null },
    ], error: null } as never)
    const r = await StudyPlanService.getClassWeek(CLASS, '2026-09-07')
    expect(r.students.map(s => s.items.length)).toEqual([0, 1])

    vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(false)
    const r2 = await StudyPlanService.getClassWeek(CLASS, '2026-09-07')
    expect(r2.students).toEqual([])
    expect(r2.error).toBe('Bu sınıfa atanmış değilsiniz.')
  })
  it('getStudentWeek: profiles join → teacher_name', async () => {
    vi.mocked(StudyPlanRepository.listStudentItems).mockResolvedValue({ data: [
      { id: 'i1', student_id: STUDENT, teacher_id: 't2', subject: 'Fizik', week_start: '2026-09-07', plan_date: null, source: null, description: 'd', status: 'eksik', note: null, profiles: { full_name: 'Fizikçi' } },
    ], error: null } as never)
    const r = await StudyPlanService.getStudentWeek(STUDENT, '2026-09-07')
    expect(r.items[0].teacher_name).toBe('Fizikçi')
  })
  it('canWriteFor: izin + sınıf ataması', async () => {
    expect(await StudyPlanService.canWriteFor(STUDENT)).toBe(true)
    vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(false)
    expect(await StudyPlanService.canWriteFor(STUDENT)).toBe(false)
  })
  it('getSources: homework.read izni yoksa boş döner, repo çağrılmaz', async () => {
    vi.mocked(requireAbility).mockResolvedValue(ability(NO_WRITE.filter(p => p.resource !== 'homework')))
    const r = await StudyPlanService.getSources(STUDENT)
    expect(r).toEqual([])
    expect(StudyPlanRepository.listSources).not.toHaveBeenCalled()
  })
})

describe('StudyPlanService.removeSource', () => {
  it('kaynağın öğrencisi öğretmenin sınıfı dışındaysa reddeder, deactivate çağrılmaz', async () => {
    vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(false)
    const r = await StudyPlanService.removeSource('src-1')
    expect(r.error).toBe('Bu öğrencinin sınıfına atanmış değilsiniz.')
    expect(StudyPlanRepository.deactivateSource).not.toHaveBeenCalled()
  })
  it('mutlu yol: sınıf ataması var → deactivate çağrılır', async () => {
    const r = await StudyPlanService.removeSource('src-1')
    expect(r).toEqual({})
    expect(StudyPlanRepository.deactivateSource).toHaveBeenCalledWith('src-1', SCHOOL)
  })
})
