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
    findStudentHomeworkProfile:   vi.fn(),
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

  it('due_date null ile ödev oluşturulur (şablon)', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.insertHomework).mockResolvedValue({ data: { id: 'hw-tmpl' }, error: null } as never)
    const result = await HomeworkService.createHomework({
      ...HW_DATA,
      due_date: null,
      is_template: true,
    })
    expect(result.error).toBeUndefined()
    expect(HomeworkRepository.insertHomework).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: null, is_template: true })
    )
  })

  it('source_id null ile ödev oluşturulur', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.insertHomework).mockResolvedValue({ data: { id: 'hw-nosrc' }, error: null } as never)
    const result = await HomeworkService.createHomework({ ...HW_DATA, source_id: null })
    expect(result.error).toBeUndefined()
    expect(HomeworkRepository.insertHomework).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: null })
    )
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
describe('HomeworkService.updateSubmissionStatus() — cross-school', () => {
  it('başka okul school_id ile ödev bulunamaz → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: null, error: null,
    } as never)
    const result = await HomeworkService.updateSubmissionStatus('hw-other', 'stu-1', 'yapildi')
    expect(result.error).toBe('Ödev bulunamadı')
    expect(HomeworkRepository.upsertSubmissionStatus).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.updateSubmissionStatus() — concurrency', () => {
  it('aynı öğrenci için paralel iki güncelleme — her ikisi de başarılı döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: { teacher_id: TEACHER_ID }, error: null,
    } as never)

    vi.mocked(HomeworkRepository.upsertSubmissionStatus)
      .mockResolvedValueOnce({ error: null } as never)
      .mockResolvedValueOnce({ error: null } as never)

    const [r1, r2] = await Promise.all([
      HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi'),
      HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'eksik'),
    ])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(HomeworkRepository.upsertSubmissionStatus).toHaveBeenCalledTimes(2)
  })

  it('bir istek başarısız olursa diğeri etkilenmez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: { teacher_id: TEACHER_ID }, error: null,
    } as never)

    vi.mocked(HomeworkRepository.upsertSubmissionStatus)
      .mockResolvedValueOnce({ error: { message: 'DB bağlantı hatası' } } as never)
      .mockResolvedValueOnce({ error: null } as never)

    const [r1, r2] = await Promise.all([
      HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi'),
      HomeworkService.updateSubmissionStatus('hw-1', 'stu-2', 'eksik'),
    ])

    expect(r1.error).toBe('DB bağlantı hatası')
    expect(r2.success).toBe(true)
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

// ─────────────────────────────────────────────────────────────
describe('HomeworkService.getStudentHomeworkProfile()', () => {
  const STU_ID = 'student-1'
  const CLS_ID = 'class-1'

  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    expect(result).toMatchObject({ error: 'Giriş gerekli' })
  })

  it('homework:read izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    expect(result).toMatchObject({ error: 'Bu işlem için yetkiniz yok.' })
  })

  it('öğrenci bulunamazsa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: null, homeworks: [], submissions: [],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    expect(result).toMatchObject({ error: 'Öğrenci bulunamadı' })
  })

  it('ödev yoksa boş liste + stats döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: { full_name: 'Ayşe', student_number: '5', veli_ad: 'Anne', veli_telefon: '05001234567' },
      homeworks: [],
      submissions: [],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    if ('error' in result) throw new Error(result.error)
    expect(result.homeworks).toHaveLength(0)
    expect(result.stats.total).toBe(0)
    expect(result.stats.completionRate).toBe(0)
  })

  it('submission yoksa tümü yapilmadi sayılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: { full_name: 'Ali', student_number: null, veli_ad: null, veli_telefon: null },
      homeworks: [
        { id: 'hw-1', title: 'Ödev A', subject: 'Matematik', due_date: '2026-05-01' },
        { id: 'hw-2', title: 'Ödev B', subject: 'Fen', due_date: '2026-05-10' },
      ],
      submissions: [],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    if ('error' in result) throw new Error(result.error)
    expect(result.homeworks).toHaveLength(2)
    expect(result.homeworks.every(h => h.status === 'yapilmadi')).toBe(true)
    expect(result.stats.yapilmadi).toBe(2)
    expect(result.stats.completionRate).toBe(0)
  })

  it('submission varsa doğru statüsü kullanır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: { full_name: 'Ali', student_number: null, veli_ad: null, veli_telefon: null },
      homeworks: [
        { id: 'hw-1', title: 'Ödev A', subject: 'Matematik', due_date: '2026-05-01' },
        { id: 'hw-2', title: 'Ödev B', subject: 'Fen', due_date: '2026-05-10' },
      ],
      submissions: [
        { homework_id: 'hw-1', status: 'yapildi', note: null },
        { homework_id: 'hw-2', status: 'eksik', note: 'Yarısı eksik' },
      ],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    if ('error' in result) throw new Error(result.error)
    const hw1 = result.homeworks.find(h => h.id === 'hw-1')!
    const hw2 = result.homeworks.find(h => h.id === 'hw-2')!
    expect(hw1.status).toBe('yapildi')
    expect(hw2.status).toBe('eksik')
    expect(hw2.note).toBe('Yarısı eksik')
    expect(result.stats.yapildi).toBe(1)
    expect(result.stats.completionRate).toBe(50)
  })

  it('null due_date olan ödev profile\'da düzgün işlenir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: { full_name: 'Test', student_number: null, veli_ad: null, veli_telefon: null },
      homeworks: [
        { id: 'hw-1', title: 'Şablon', subject: 'Mat', due_date: null },
      ],
      submissions: [],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile('stu-1', 'cls-1')
    if ('error' in result) throw new Error(result.error)
    expect(result.homeworks[0].due_date).toBeNull()
    expect(result.homeworks[0].status).toBe('yapilmadi')
  })
})
