import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/dashboard/repositories/DashboardRepository', () => ({
  DashboardRepository: {
    getTeacherHomeworks:      vi.fn(),
    getSubmissions:           vi.fn(),
    getAttendanceRows:        vi.fn(),
    getStudentsByClasses:     vi.fn(),
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
  it('3 kaçırma → risk uyarısı (low olmayan) üretir', async () => {
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

    const metrics = await TeacherDashboardService.getDashboardMetrics(TEACHER_ID)
    expect(metrics.riskAlerts.filter(a => a.riskLevel !== 'low')).toHaveLength(1)
  })
})

describe('getRiskAlerts', () => {
  it('risk olan öğrencileri döner, snapshot yazmaz', async () => {
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

    const alerts = await TeacherDashboardService.getRiskAlerts(TEACHER_ID)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].riskLevel).toBe('high')
  })

  it('risk olmayan öğrencileri döndürmez', async () => {
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })

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

  // 2026-10-03: payda mazeretliyi de sayıyordu; hiç kontrol yokken %0 gösteriyordu (analitik ile aynı tanım)
  const ogrenciler = { data: [{ id: 's1', full_name: 'A', class_id: CLASS_ID }, { id: 's2', full_name: 'B', class_id: CLASS_ID }] }

  it('mazeretli paydaya girmez: 1 yapıldı + 1 mazeretli → %100', async () => {
    ;(DashboardRepository.getClassSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [
      { homework_id: 'h1', student_id: 's1', status: 'yapildi' },
      { homework_id: 'h1', student_id: 's2', status: 'mazeretli' },
    ] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue(ogrenciler)

    const result = await TeacherDashboardService.getClassSummary(CLASS_ID, TEACHER_ID)
    expect(result!.avgCompletionPct).toBe(100)
  })

  it('hiç kontrol edilmiş ödev yoksa oran null (%0 değil)', async () => {
    ;(DashboardRepository.getClassSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue(ogrenciler)

    const result = await TeacherDashboardService.getClassSummary(CLASS_ID, TEACHER_ID)
    expect(result!.avgCompletionPct).toBeNull()
  })
})
