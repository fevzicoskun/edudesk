import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/shared/auth', () => ({ getCurrentProfile: vi.fn() }))
vi.mock('@/src/shared/authorization/server', () => ({ getAbility: vi.fn() }))
vi.mock('@/src/domains/schedule/repositories/ScheduleRepository', () => ({ ScheduleRepository: { getByTeacher: vi.fn() } }))
vi.mock('@/src/domains/homework/repositories/HomeworkRepository', () => ({ HomeworkRepository: { findOwnSubject: vi.fn() } }))

const { getCurrentProfile } = await import('@/src/shared/auth')
const { getAbility } = await import('@/src/shared/authorization/server')
const { ScheduleRepository } = await import('@/src/domains/schedule/repositories/ScheduleRepository')
const { HomeworkRepository } = await import('@/src/domains/homework/repositories/HomeworkRepository')
const { HomeworkService } = await import('@/src/domains/homework/services/HomeworkService')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: 't1', school_id: 's1', subject: 'Matematik', role: 'zumre_baskani' } as never)
  vi.mocked(getAbility).mockResolvedValue({ userId: 't1', schoolId: 's1' } as never)
  // ders programı yok → branş Matematik → Matematik + Geometri
  vi.mocked(ScheduleRepository.getByTeacher).mockResolvedValue({ data: null, error: null } as never)
})

describe('HomeworkService.dersHatasi — action sınırı', () => {
  it('öğretmenin listesindeki ders geçer (programsız Matematik branşına Geometri dahil)', async () => {
    expect(await HomeworkService.dersHatasi('Matematik')).toBeNull()
    expect(await HomeworkService.dersHatasi('Geometri')).toBeNull()
  })

  it('listede olmayan ders reddedilir', async () => {
    expect(await HomeworkService.dersHatasi('Kimya')).toMatch(/ders listenizde yok/)
    expect(await HomeworkService.dersHatasi('matematik')).toMatch(/ders listenizde yok/) // yazım birebir olmalı
  })

  it('düzenlemede ödevin mevcut dersi listede olmasa da geçer; başka ders geçmez', async () => {
    vi.mocked(HomeworkRepository.findOwnSubject).mockResolvedValue({ data: { subject: 'Edebiyat' }, error: null } as never)
    expect(await HomeworkService.dersHatasi('Edebiyat', 'hw1')).toBeNull()
    expect(await HomeworkService.dersHatasi('Kimya', 'hw1')).toMatch(/ders listenizde yok/)
  })

  it('programdaki ders sınıf bazında listeye girer', async () => {
    vi.mocked(ScheduleRepository.getByTeacher).mockResolvedValue({ data: { slots: [{ day: 1, period: 1, subject: 'S-KİM', class_id: 'c1' }] }, error: null } as never)
    expect(await HomeworkService.dersHatasi('Kimya')).toBeNull()
    expect(await HomeworkService.dersHatasi('Matematik')).toMatch(/ders listenizde yok/) // program varsa branş kullanılmaz
  })
})
