import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({
  requireAbility: vi.fn(),
  getAbility: vi.fn(),
}))
vi.mock('@/src/shared/auth', () => ({ getCurrentProfile: vi.fn() }))
vi.mock('@/src/domains/mentor/repositories/MentorRepository', () => ({
  MentorRepository: {
    listMentorships: vi.fn(),
    insertMentorship: vi.fn(),
    deleteMentorship: vi.fn(),
    findStudentInSchool: vi.fn(),
    lastReportDates: vi.fn(),
    findMentorship: vi.fn(),
    insertMentorReport: vi.fn(),
    findMentorshipAtama: vi.fn(),
    mentorAdlari: vi.fn(),
    findSchoolTeacher: vi.fn(),
    countStudentsInSchool: vi.fn(),
    upsertMentorships: vi.fn(),
    deleteMentorshipsByStudents: vi.fn(),
  },
}))

const { requireAbility } = await import('@/src/shared/authorization/server')
const { MentorRepository } = await import('@/src/domains/mentor/repositories/MentorRepository')
const { MentorService } = await import('@/src/domains/mentor/services/MentorService')
const { getCurrentProfile } = await import('@/src/shared/auth')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID = 'school-1'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'
const STUDENT_2 = '22222222-2222-4222-8222-222222222222'
const IDARE_ID = 'idare-1'

function profil(role: string) {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: IDARE_ID, school_id: SCHOOL_ID, role } as never)
}

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
      mentor_id: TEACHER_ID, student_id: STUDENT_ID, school_id: SCHOOL_ID, assigned_by: TEACHER_ID,
    })
  })

  it('aynı öğrenci ikinci kez eklenirse anlaşılır hata döner (23505)', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
      data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'c1' },
    } as never)
    vi.mocked(MentorRepository.insertMentorship).mockResolvedValue({
      data: null, error: { code: '23505', message: 'duplicate key' },
    } as never)

    vi.mocked(MentorRepository.mentorAdlari).mockResolvedValue({
      data: [{ student_id: STUDENT_ID, mentor_id: TEACHER_ID, mentor_adi: 'Ben' }], error: null,
    } as never)

    const result = await MentorService.addMentorship(STUDENT_ID)
    expect(result.error).toBe('Bu öğrenci zaten listenizde')
  })

  it('başka mentörün öğrencisi eklenirse mevcut mentörün adını söyler', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
      data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'c1' },
    } as never)
    vi.mocked(MentorRepository.insertMentorship).mockResolvedValue({
      data: null, error: { code: '23505', message: 'duplicate key' },
    } as never)
    vi.mocked(MentorRepository.mentorAdlari).mockResolvedValue({
      data: [{ student_id: STUDENT_ID, mentor_id: 'm2', mentor_adi: 'Ayşe Kaya' }], error: null,
    } as never)

    expect(await MentorService.addMentorship(STUDENT_ID)).toEqual({ error: 'Bu öğrencinin mentörü Ayşe Kaya' })
  })
})

describe('MentorService.removeMentorship()', () => {
  it('idare atamasını mentör kaldıramaz — açık mesaj, silme denenmez', async () => {
    vi.mocked(MentorRepository.findMentorshipAtama).mockResolvedValue({ data: { assigned_by: IDARE_ID }, error: null } as never)
    expect(await MentorService.removeMentorship(STUDENT_ID)).toEqual({
      error: 'Bu atamayı idare yaptı; kaldırmak için idareye başvurun.',
    })
    expect(MentorRepository.deleteMentorship).not.toHaveBeenCalled()
  })

  it('0 satır etkilenirse sessiz başarı değil hata döner', async () => {
    vi.mocked(MentorRepository.findMentorshipAtama).mockResolvedValue({ data: { assigned_by: TEACHER_ID }, error: null } as never)
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
        { id: 'm1', student_id: 's1', assigned_by: TEACHER_ID, students: { id: 's1', full_name: 'Ahmet', class_id: 'c1', classes: { name: '11-B' } } },
        { id: 'm2', student_id: 's2', assigned_by: IDARE_ID, students: { id: 's2', full_name: 'Elif', class_id: 'c1', classes: { name: '11-B' } } },
      ],
      error: null,
    } as never)
    vi.mocked(MentorRepository.lastReportDates).mockResolvedValue({
      data: [{ student_id: 's1', report_date: '2026-09-12' }],
      error: null,
    } as never)

    const rows = await MentorService.getMyMentorships()

    expect(rows).toEqual([
      { student_id: 's1', full_name: 'Ahmet', class_name: '11-B', last_report_date: '2026-09-12', idare_atadi: false },
      { student_id: 's2', full_name: 'Elif', class_name: '11-B', last_report_date: null, idare_atadi: true },
    ])
  })

  it('okuma hatası sessizce [] dönmez, fırlatır', async () => {
    vi.mocked(MentorRepository.listMentorships).mockResolvedValue({ data: null, error: { message: 'boom' } } as never)
    vi.mocked(MentorRepository.lastReportDates).mockResolvedValue({ data: [], error: null } as never)
    await expect(MentorService.getMyMentorships()).rejects.toThrow('boom')
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

describe('MentorService.assignMentors() — idare toplu atama', () => {
  it('öğretmen rolü reddedilir', async () => {
    profil('ogretmen')
    expect(await MentorService.assignMentors([STUDENT_ID], 'm1')).toEqual({ error: 'Bu işlem için yetkiniz yok' })
    expect(MentorRepository.upsertMentorships).not.toHaveBeenCalled()
  })

  it('boş liste reddedilir', async () => {
    profil('mudur')
    expect(await MentorService.assignMentors([], 'm1')).toEqual({ error: 'Öğrenci seçilmedi' })
  })

  it('mentör okulun öğretmeni değilse reddedilir', async () => {
    profil('mudur')
    vi.mocked(MentorRepository.findSchoolTeacher).mockResolvedValue({ data: null } as never)
    expect(await MentorService.assignMentors([STUDENT_ID], 'x')).toEqual({ error: 'Seçilen öğretmen bu okulda bulunamadı' })
  })

  it('tek yabancı öğrenci varsa hiçbir şey yazılmaz (fail-closed)', async () => {
    profil('mudur_yardimcisi')
    vi.mocked(MentorRepository.findSchoolTeacher).mockResolvedValue({ data: { id: 'm1' } } as never)
    vi.mocked(MentorRepository.countStudentsInSchool).mockResolvedValue({ count: 1, error: null } as never)
    expect(await MentorService.assignMentors([STUDENT_ID, STUDENT_2], 'm1')).toEqual({ error: 'Öğrenci bulunamadı' })
    expect(MentorRepository.upsertMentorships).not.toHaveBeenCalled()
  })

  it('upsert assigned_by = idare kullanıcısı; aynı id iki kez gelirse tekilleşir', async () => {
    profil('mudur_yardimcisi')
    vi.mocked(MentorRepository.findSchoolTeacher).mockResolvedValue({ data: { id: 'm1' } } as never)
    vi.mocked(MentorRepository.countStudentsInSchool).mockResolvedValue({ count: 1, error: null } as never)
    vi.mocked(MentorRepository.upsertMentorships).mockResolvedValue({ data: [{ id: 'r1' }], error: null } as never)
    expect(await MentorService.assignMentors([STUDENT_ID, STUDENT_ID], 'm1')).toEqual({})
    expect(MentorRepository.upsertMentorships).toHaveBeenCalledWith([
      { student_id: STUDENT_ID, mentor_id: 'm1', school_id: SCHOOL_ID, assigned_by: IDARE_ID },
    ])
  })

  it('upsert eksik satır dönerse hata (sessiz yazma yok)', async () => {
    profil('mudur')
    vi.mocked(MentorRepository.findSchoolTeacher).mockResolvedValue({ data: { id: 'm1' } } as never)
    vi.mocked(MentorRepository.countStudentsInSchool).mockResolvedValue({ count: 2, error: null } as never)
    vi.mocked(MentorRepository.upsertMentorships).mockResolvedValue({ data: [{ id: 'r1' }], error: null } as never)
    expect(await MentorService.assignMentors([STUDENT_ID, STUDENT_2], 'm1')).toEqual({ error: 'Atama kaydedilemedi' })
  })

  it('mentorId null → seçilenlerin mentörlüğü silinir', async () => {
    profil('mudur')
    vi.mocked(MentorRepository.countStudentsInSchool).mockResolvedValue({ count: 2, error: null } as never)
    vi.mocked(MentorRepository.deleteMentorshipsByStudents).mockResolvedValue({ error: null } as never)
    expect(await MentorService.assignMentors([STUDENT_ID, STUDENT_2], null)).toEqual({})
    expect(MentorRepository.deleteMentorshipsByStudents).toHaveBeenCalledWith([STUDENT_ID, STUDENT_2], SCHOOL_ID)
  })
})
