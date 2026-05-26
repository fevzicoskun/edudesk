import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/dashboard/repositories/DashboardRepository', () => ({
  DashboardRepository: {
    getTeacherHomeworks:      vi.fn(),
    getSubmissions:           vi.fn(),
    getAttendanceRows:        vi.fn(),
    getStudentsByClasses:     vi.fn(),
    getWeeklySubmissionStats: vi.fn(),
    getWeeklyRiskCount:       vi.fn(),
    insertRiskSnapshots:      vi.fn(),
    insertActivityLog:        vi.fn(),
    getClassSubmissions:      vi.fn(),
  },
}))

vi.mock('@/src/shared/auth', () => ({
  getCurrentProfile: vi.fn(),
}))

const { DashboardRepository } = await import('@/src/domains/dashboard/repositories/DashboardRepository')
const { getCurrentProfile }   = await import('@/src/shared/auth')
const { TeacherDashboardService } = await import('@/src/domains/dashboard/services/TeacherDashboardService')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID  = 'school-1'
const HW_ID      = 'hw-1'
const CLASS_ID   = 'class-1'
const STUDENT_ID = 'student-1'

beforeEach(() => {
  vi.clearAllMocks()
  ;(getCurrentProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ school_id: SCHOOL_ID })
})

describe('getDashboardMetrics', () => {
  it('bugün teslim ödev sayısını doğru sayar', async () => {
    const today = new Date().toISOString().split('T')[0]
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: HW_ID, title: 'Test', subject: 'Mat', due_date: today, class_id: CLASS_ID, classes: { name: '10-A', grade: 10 } }],
    })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklySubmissionStats as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklyRiskCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    const metrics = await TeacherDashboardService.getDashboardMetrics(TEACHER_ID)
    expect(metrics.todayHomeworkCount).toBe(1)
  })

  it('eksik submission toplamını doğru sayar', async () => {
    const pastDate = '2020-01-01'
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: HW_ID, title: 'Test', subject: 'Mat', due_date: pastDate, class_id: CLASS_ID, classes: null }],
    })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { homework_id: HW_ID, student_id: STUDENT_ID, status: 'eksik' },
        { homework_id: HW_ID, student_id: 'student-2', status: 'yapildi' },
      ],
    })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklySubmissionStats as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklyRiskCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    const metrics = await TeacherDashboardService.getDashboardMetrics(TEACHER_ID)
    expect(metrics.totalMissingCount).toBe(1)
  })

  it('aktif risk sayısını doğru hesaplar (3 miss → high risk)', async () => {
    const pastDate = '2020-01-01'
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => ({
        id: `hw-${i}`, title: 'T', subject: 'Mat', due_date: pastDate, class_id: CLASS_ID, classes: null,
      })),
    })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Array.from({ length: 3 }, (_, i) => ({
        homework_id: `hw-${i}`, student_id: STUDENT_ID, status: 'eksik',
      })),
    })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: STUDENT_ID, full_name: 'Ahmet', class_id: CLASS_ID, classes: { name: '10-A' } }],
    })
    ;(DashboardRepository.getWeeklySubmissionStats as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklyRiskCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    const metrics = await TeacherDashboardService.getDashboardMetrics(TEACHER_ID)
    expect(metrics.activeRiskCount).toBe(1)
  })
})

describe('getRiskAlerts', () => {
  it('risk olan öğrencileri döner ve history snapshot yazar', async () => {
    const pastDate = '2020-01-01'
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => ({
        id: `hw-${i}`, title: 'T', subject: 'Mat', due_date: pastDate, class_id: CLASS_ID, classes: null,
      })),
    })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Array.from({ length: 3 }, (_, i) => ({
        homework_id: `hw-${i}`, student_id: STUDENT_ID, status: 'eksik',
      })),
    })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: STUDENT_ID, full_name: 'Ahmet', class_id: CLASS_ID, classes: { name: '10-A' } }],
    })
    ;(DashboardRepository.insertRiskSnapshots as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const alerts = await TeacherDashboardService.getRiskAlerts(TEACHER_ID)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].riskLevel).toBe('high')
    expect(DashboardRepository.insertRiskSnapshots).toHaveBeenCalledOnce()
  })

  it('risk olmayan öğrencileri döndürmez', async () => {
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.insertRiskSnapshots as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const alerts = await TeacherDashboardService.getRiskAlerts(TEACHER_ID)
    expect(alerts).toHaveLength(0)
  })
})

describe('logActivity', () => {
  it('hata fırlatmaz — repo hatası sessiz geçer', async () => {
    ;(DashboardRepository.insertActivityLog as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB error')
    )
    await expect(
      TeacherDashboardService.logActivity(TEACHER_ID, 'dashboard_view')
    ).resolves.toBeUndefined()
  })
})

describe('getClassSummary', () => {
  it('sınıfta öğrenci yoksa null döner', async () => {
    ;(DashboardRepository.getClassSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })

    const result = await TeacherDashboardService.getClassSummary(CLASS_ID, TEACHER_ID)
    expect(result).toBeNull()
  })
})
