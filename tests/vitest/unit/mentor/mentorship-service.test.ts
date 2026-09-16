import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({
  requireAbility: vi.fn(),
  getAbility: vi.fn(),
}))
vi.mock('@/src/domains/mentor/repositories/MentorRepository', () => ({
  MentorRepository: {
    listMentorships: vi.fn(),
    insertMentorship: vi.fn(),
    deleteMentorship: vi.fn(),
    findStudentInSchool: vi.fn(),
    lastReportDates: vi.fn(),
    findMentorship: vi.fn(),
    insertMentorReport: vi.fn(),
  },
}))

const { requireAbility } = await import('@/src/shared/authorization/server')
const { MentorRepository } = await import('@/src/domains/mentor/repositories/MentorRepository')
const { MentorService } = await import('@/src/domains/mentor/services/MentorService')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID = 'school-1'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'

function ability() {
  return createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: OGRETMEN_PERMS })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAbility).mockResolvedValue(ability() as never)
})

describe('MentorService.addMentorship()', () => {
  it('başka okulun öğrencisi eklenemez', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({ data: null } as never)
    const result = await MentorService.addMentorship(STUDENT_ID)
    expect(result.error).toBe('Öğrenci bulunamadı')
    expect(MentorRepository.insertMentorship).not.toHaveBeenCalled()
  })

  it('kendi okulunun öğrencisi mentor_id ile eklenir', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
      data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'c1' },
    } as never)
    vi.mocked(MentorRepository.insertMentorship).mockResolvedValue({ data: { id: 'm1' }, error: null } as never)

    const result = await MentorService.addMentorship(STUDENT_ID)

    expect(result.error).toBeUndefined()
    expect(MentorRepository.insertMentorship).toHaveBeenCalledWith({
      mentor_id: TEACHER_ID, student_id: STUDENT_ID, school_id: SCHOOL_ID,
    })
  })

  it('aynı öğrenci ikinci kez eklenirse anlaşılır hata döner (23505)', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
      data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'c1' },
    } as never)
    vi.mocked(MentorRepository.insertMentorship).mockResolvedValue({
      data: null, error: { code: '23505', message: 'duplicate key' },
    } as never)

    const result = await MentorService.addMentorship(STUDENT_ID)
    expect(result.error).toBe('Bu öğrenci zaten listenizde')
  })
})

describe('MentorService.removeMentorship()', () => {
  it('0 satır etkilenirse sessiz başarı değil hata döner', async () => {
    vi.mocked(MentorRepository.deleteMentorship).mockResolvedValue({
      error: { message: 'Kayıt bulunamadı veya yetkiniz yok.' },
    } as never)
    const result = await MentorService.removeMentorship(STUDENT_ID)
    expect(result.error).toBe('Kayıt bulunamadı veya yetkiniz yok.')
  })
})

describe('MentorService.getMyMentorships()', () => {
  it('son görüşme tarihini öğrenciyle eşleştirir, hiç görüşülmeyende null verir', async () => {
    vi.mocked(MentorRepository.listMentorships).mockResolvedValue({
      data: [
        { id: 'm1', student_id: 's1', students: { id: 's1', full_name: 'Ahmet', class_id: 'c1', classes: { name: '11-B' } } },
        { id: 'm2', student_id: 's2', students: { id: 's2', full_name: 'Elif', class_id: 'c1', classes: { name: '11-B' } } },
      ],
      error: null,
    } as never)
    vi.mocked(MentorRepository.lastReportDates).mockResolvedValue({
      data: [{ student_id: 's1', report_date: '2026-09-12' }],
      error: null,
    } as never)

    const rows = await MentorService.getMyMentorships()

    expect(rows).toEqual([
      { student_id: 's1', full_name: 'Ahmet', class_name: '11-B', last_report_date: '2026-09-12' },
      { student_id: 's2', full_name: 'Elif', class_name: '11-B', last_report_date: null },
    ])
  })
})

describe('MentorService.addMentorReport() — yeni yetki modeli', () => {
  it('öğrenci mentörlük listemde değilse not eklenemez', async () => {
    vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: null } as never)
    const result = await MentorService.addMentorReport({
      student_id: STUDENT_ID, content: 'Görüşme yapıldı', report_date: '2026-09-16',
    })
    expect(result.error).toBe('Bu öğrenci mentörlük listenizde değil')
    expect(MentorRepository.insertMentorReport).not.toHaveBeenCalled()
  })

  it('öğrenci okulda bulunamazsa not eklenemez (trust boundary)', async () => {
    vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: { id: 'm1' } } as never)
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({ data: null } as never)

    const result = await MentorService.addMentorReport({
      student_id: STUDENT_ID, content: 'Görüşme yapıldı', report_date: '2026-09-16',
    })

    expect(result.error).toBe('Öğrenci bulunamadı')
    expect(MentorRepository.insertMentorReport).not.toHaveBeenCalled()
  })

  it('listemdeki öğrenciye not eklenir, mentor_id sunucudan konur', async () => {
    vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: { id: 'm1' } } as never)
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
      data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'c1' },
    } as never)
    vi.mocked(MentorRepository.insertMentorReport).mockResolvedValue({ data: { id: 'r1' }, error: null } as never)

    const result = await MentorService.addMentorReport({
      student_id: STUDENT_ID, content: 'Görüşme yapıldı', report_date: '2026-09-16',
    })

    expect(result.error).toBeUndefined()
    const arg = vi.mocked(MentorRepository.insertMentorReport).mock.calls[0][0] as Record<string, unknown>
    expect(arg.mentor_id).toBe(TEACHER_ID)
    expect(arg.school_id).toBe(SCHOOL_ID)
    expect(arg.class_id).toBe('c1')
  })

  it('class_id istemciden değil öğrencinin gerçek kaydından alınır (başka okulun ID\'si göz ardı edilir)', async () => {
    vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: { id: 'm1' } } as never)
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
      data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'gercek-sinif-id' },
    } as never)
    vi.mocked(MentorRepository.insertMentorReport).mockResolvedValue({ data: { id: 'r1' }, error: null } as never)

    // Servis imzasında artık class_id parametresi yok — istemciden hiç alınmıyor
    await MentorService.addMentorReport({
      student_id: STUDENT_ID, content: 'Görüşme yapıldı', report_date: '2026-09-16',
    })

    const arg = vi.mocked(MentorRepository.insertMentorReport).mock.calls[0][0] as Record<string, unknown>
    expect(arg.class_id).toBe('gercek-sinif-id')
  })
})
