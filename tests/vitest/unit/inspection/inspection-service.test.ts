import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/inspection/repositories/InspectionRepository', () => ({
  InspectionRepository: {
    countDailyPlansThisTerm:     vi.fn(),
    countSokReportsThisTerm:     vi.fn(),
    countNotebookChecksThisTerm: vi.fn(),
  },
}))

vi.mock('@/src/shared/auth', () => ({
  getCurrentProfile: vi.fn(),
}))

const { InspectionRepository } = await import('@/src/domains/inspection/repositories/InspectionRepository')
const { getCurrentProfile }    = await import('@/src/shared/auth')
const { InspectionService }    = await import('@/src/domains/inspection/services/InspectionService')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID  = 'school-1'

beforeEach(() => {
  vi.clearAllMocks()
  ;(getCurrentProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: TEACHER_ID, school_id: SCHOOL_ID, subject: 'Matematik',
  })
})

describe('getCompletionStatus', () => {
  it('4 belgeden 4ü mevcut → skor 100', async () => {
    ;(InspectionRepository.countDailyPlansThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 })
    ;(InspectionRepository.countSokReportsThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })
    ;(InspectionRepository.countNotebookChecksThisTerm as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 })
    const result = await InspectionService.getCompletionStatus({ zumreCount: 1 })
    expect(result.score).toBe(100)
    expect(result.dailyPlans).toBe(true)
    expect(result.annualPlan).toBe(false)
    expect(result.commonExams).toBe(false)
  })

  it('yalnızca günlük plan mevcut → skor 25 (1/4)', async () => {
    ;(InspectionRepository.countDailyPlansThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })
    ;(InspectionRepository.countSokReportsThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    ;(InspectionRepository.countNotebookChecksThisTerm as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    const result = await InspectionService.getCompletionStatus({ zumreCount: 0 })
    expect(result.score).toBe(25)
    expect(result.dailyPlans).toBe(true)
    expect(result.annualPlan).toBe(false)
    expect(result.zumreMeetings).toBe(false)
  })

  it('hiç belge yok → skor 0', async () => {
    ;(InspectionRepository.countDailyPlansThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    ;(InspectionRepository.countSokReportsThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    ;(InspectionRepository.countNotebookChecksThisTerm as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    const result = await InspectionService.getCompletionStatus({ zumreCount: 0 })
    expect(result.score).toBe(0)
    expect(result.dailyPlans).toBe(false)
    expect(result.annualPlan).toBe(false)
  })

  it('profil null ise hata fırlatır', async () => {
    ;(getCurrentProfile as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(InspectionService.getCompletionStatus({ zumreCount: 0, examCount: 0 }))
      .rejects.toThrow('Profil bulunamadı')
  })
})
