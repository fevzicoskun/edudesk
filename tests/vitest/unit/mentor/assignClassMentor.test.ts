import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/shared/auth', () => ({
  getCurrentProfile: vi.fn(),
}))

vi.mock('@/src/domains/mentor/repositories/MentorRepository', () => ({
  MentorRepository: {
    findSchoolStaff: vi.fn(),
    setClassMentor:  vi.fn(),
  },
}))

// requireAbility/createClient yalnızca diğer metodlarca kullanılıyor; assignClassMentor için gerekmez
vi.mock('@/src/shared/authorization/server', () => ({ requireAbility: vi.fn() }))
vi.mock('@/src/infrastructure/supabase/server', () => ({ createClient: vi.fn() }))

const { getCurrentProfile } = await import('@/src/shared/auth')
const { MentorRepository }  = await import('@/src/domains/mentor/repositories/MentorRepository')
const { MentorService }     = await import('@/src/domains/mentor/services/MentorService')

const SCHOOL_ID  = 'school-1'
const CLASS_ID   = 'class-1'
const TEACHER_ID = 'teacher-1'

function setProfile(role: string, schoolId: string | null = SCHOOL_ID) {
  ;(getCurrentProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
    schoolId ? { id: 'u1', role, school_id: schoolId } : null,
  )
}

describe('MentorService.assignClassMentor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(MentorRepository.setClassMentor as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
    ;(MentorRepository.findSchoolStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: TEACHER_ID } })
  })

  it('öğretmen atayamaz (yetki yok), DB güncellenmez', async () => {
    setProfile('ogretmen')
    const res = await MentorService.assignClassMentor(CLASS_ID, TEACHER_ID)
    expect(res.error).toBeTruthy()
    expect(MentorRepository.setClassMentor).not.toHaveBeenCalled()
  })

  it('giriş yoksa hata döner', async () => {
    setProfile('mudur', null)
    const res = await MentorService.assignClassMentor(CLASS_ID, TEACHER_ID)
    expect(res.error).toBeTruthy()
    expect(MentorRepository.setClassMentor).not.toHaveBeenCalled()
  })

  it('başka okuldan öğretmen atanamaz', async () => {
    setProfile('mudur_yardimcisi')
    ;(MentorRepository.findSchoolStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null })
    const res = await MentorService.assignClassMentor(CLASS_ID, TEACHER_ID)
    expect(res.error).toContain('bulunamadı')
    expect(MentorRepository.setClassMentor).not.toHaveBeenCalled()
  })

  it('müdür geçerli öğretmen atar', async () => {
    setProfile('mudur')
    const res = await MentorService.assignClassMentor(CLASS_ID, TEACHER_ID)
    expect(res.error).toBeUndefined()
    expect(MentorRepository.setClassMentor).toHaveBeenCalledWith(CLASS_ID, TEACHER_ID, SCHOOL_ID)
  })

  it('mentör kaldırma (null) okul doğrulaması yapmadan geçer', async () => {
    setProfile('mudur')
    const res = await MentorService.assignClassMentor(CLASS_ID, null)
    expect(res.error).toBeUndefined()
    expect(MentorRepository.findSchoolStaff).not.toHaveBeenCalled()
    expect(MentorRepository.setClassMentor).toHaveBeenCalledWith(CLASS_ID, null, SCHOOL_ID)
  })
})
