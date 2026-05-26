import { DashboardRepository } from '../repositories/DashboardRepository'
import { computeRiskLevel, computeRiskScore } from '../risk'
import { getCurrentProfile } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'
import type { DashboardMetrics, RiskAlert, ClassSummary, HomeworkLite } from '../types'

type StudentRow = { id: string; full_name: string; class_id: string; classes: { name: string } | null }
type SubmissionRow = { homework_id: string; student_id: string; status: string }
type HwRow = { id: string; title: string; subject: string; due_date: string; class_id: string; classes: { name: string; grade: number } | null }

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function computeAlerts(
  homeworks: HwRow[],
  submissions: SubmissionRow[],
  attendanceRows: { student_id: string; status: string }[],
  students: StudentRow[],
): RiskAlert[] {
  const lastHwByClass = new Map<string, string[]>()
  for (const hw of homeworks) {
    const arr = lastHwByClass.get(hw.class_id) ?? []
    if (arr.length < 5) arr.push(hw.id)
    lastHwByClass.set(hw.class_id, arr)
  }
  const hwToClass = new Map(homeworks.map(h => [h.id, h.class_id]))

  const hwMissMap = new Map<string, number>()
  for (const sub of submissions) {
    const cid = hwToClass.get(sub.homework_id)
    if (!cid) continue
    if (!lastHwByClass.get(cid)?.includes(sub.homework_id)) continue
    if (sub.status === 'eksik' || sub.status === 'yapilmadi' || sub.status === 'gec') {
      hwMissMap.set(sub.student_id, (hwMissMap.get(sub.student_id) ?? 0) + 1)
    }
  }

  const absenceMap = new Map<string, number>()
  for (const att of attendanceRows) {
    if (att.status === 'absent') {
      absenceMap.set(att.student_id, (absenceMap.get(att.student_id) ?? 0) + 1)
    }
  }

  const alerts: RiskAlert[] = []
  for (const student of students) {
    const hwMisses = hwMissMap.get(student.id) ?? 0
    const absences = absenceMap.get(student.id) ?? 0
    if (hwMisses === 0 && absences === 0) continue

    const reasons: string[] = []
    if (hwMisses >= 1) reasons.push(`Son 5 ödevde ${hwMisses} eksik`)
    if (absences >= 1) reasons.push(`Son 14 günde ${absences} gün devamsız`)

    alerts.push({
      studentId: student.id,
      studentName: student.full_name,
      classId: student.class_id,
      className: student.classes?.name ?? '—',
      riskLevel: computeRiskLevel(hwMisses, absences),
      reasons,
      hwMisses,
      absences,
    })
  }

  const order = { high: 0, medium: 1, low: 2 } as const
  return alerts.sort((a, b) => order[a.riskLevel] - order[b.riskLevel])
}

export const TeacherDashboardService = {
  async getDashboardMetrics(teacherId: string): Promise<DashboardMetrics> {
    const today = new Date().toISOString().split('T')[0]
    const twoWeeksAgo = subDays(new Date(), 14).toISOString().split('T')[0]
    const weekStart = getWeekStart()

    const { data: hwData } = await DashboardRepository.getTeacherHomeworks(teacherId)
    const homeworks = (hwData ?? []) as unknown as HwRow[]
    const hwIds = homeworks.map(h => h.id)
    const classIds = [...new Set(homeworks.map(h => h.class_id))]

    const [subsResult, attResult, studentsResult, weeklyResult, weeklyRiskCount] = await Promise.all([
      DashboardRepository.getSubmissions(hwIds),
      DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
      DashboardRepository.getStudentsByClasses(classIds),
      DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
      DashboardRepository.getWeeklyRiskCount(teacherId, weekStart),
    ])

    const submissions = ((subsResult.data ?? []) as unknown) as SubmissionRow[]
    const attendanceRows = ((attResult.data ?? []) as unknown) as { student_id: string; status: string }[]
    const students = ((studentsResult.data ?? []) as unknown) as StudentRow[]
    const weeklySubmissions = ((weeklyResult.data ?? []) as unknown) as SubmissionRow[]

    const todayHomeworkCount = homeworks.filter(h => h.due_date === today).length
    const totalMissingCount = submissions.filter(s => s.status === 'eksik').length

    const alerts = computeAlerts(homeworks, submissions, attendanceRows, students)
    const activeRiskCount = alerts.filter(a => a.riskLevel !== 'low').length

    const weeklyDoneCount = weeklySubmissions.filter(s => s.status === 'yapildi').length
    const avgCompletionPct = weeklySubmissions.length > 0
      ? Math.round((weeklyDoneCount / weeklySubmissions.length) * 100)
      : 0

    return {
      todayHomeworkCount,
      totalMissingCount,
      activeRiskCount,
      weekly: {
        submittedCount: weeklyDoneCount,
        avgCompletionPct,
        newRiskCount: weeklyRiskCount,
      },
      homeworks: homeworks as unknown as HomeworkLite[],
    }
  },

  async getRiskAlerts(teacherId: string): Promise<RiskAlert[]> {
    const profile = await getCurrentProfile()
    const schoolId = profile?.school_id ?? ''
    const twoWeeksAgo = subDays(new Date(), 14).toISOString().split('T')[0]

    const { data: hwData } = await DashboardRepository.getTeacherHomeworks(teacherId)
    const homeworks = (hwData ?? []) as unknown as HwRow[]
    const hwIds = homeworks.map(h => h.id)
    const classIds = [...new Set(homeworks.map(h => h.class_id))]

    const [subsResult, attResult, studentsResult] = await Promise.all([
      DashboardRepository.getSubmissions(hwIds),
      DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
      DashboardRepository.getStudentsByClasses(classIds),
    ])

    const submissions = ((subsResult.data ?? []) as unknown) as SubmissionRow[]
    const attendanceRows = ((attResult.data ?? []) as unknown) as { student_id: string; status: string }[]
    const students = ((studentsResult.data ?? []) as unknown) as StudentRow[]

    const alerts = computeAlerts(homeworks, submissions, attendanceRows, students)

    if (alerts.length > 0 && schoolId) {
      await DashboardRepository.insertRiskSnapshots(
        alerts.map(a => ({
          student_id: a.studentId,
          school_id: schoolId,
          teacher_id: teacherId,
          risk_level: a.riskLevel,
          risk_score: computeRiskScore(a.hwMisses, a.absences),
          hw_misses: a.hwMisses,
          absences: a.absences,
        }))
      )
    }

    return alerts
  },

  async getClassSummary(classId: string, teacherId: string): Promise<ClassSummary | null> {
    const twoWeeksAgo = subDays(new Date(), 14).toISOString().split('T')[0]

    const [subsResult, studentsResult, attResult] = await Promise.all([
      DashboardRepository.getClassSubmissions(classId, teacherId),
      DashboardRepository.getStudentsByClasses([classId]),
      DashboardRepository.getAttendanceRows([classId], teacherId, twoWeeksAgo),
    ])

    const submissions = ((subsResult.data ?? []) as unknown) as SubmissionRow[]
    const students = ((studentsResult.data ?? []) as unknown) as StudentRow[]
    const attendanceRows = ((attResult.data ?? []) as unknown) as { student_id: string; status: string }[]

    if (students.length === 0) return null

    const doneCount = submissions.filter(s => s.status === 'yapildi').length
    const avgCompletionPct = submissions.length > 0
      ? Math.round((doneCount / submissions.length) * 100)
      : 0
    const totalMissingCount = submissions.filter(s => s.status === 'eksik').length

    const fakeHomeworks = [...new Set(submissions.map(s => s.homework_id))].map(id => ({
      id, title: '', subject: '', due_date: '', class_id: classId, classes: null,
    }))

    const alerts = computeAlerts(fakeHomeworks, submissions, attendanceRows, students)
    const riskyStudents = alerts.filter(a => a.riskLevel !== 'low')
    const highRiskCount = alerts.filter(a => a.riskLevel === 'high').length

    return { avgCompletionPct, highRiskCount, totalMissingCount, riskyStudents }
  },

  async logActivity(teacherId: string, action: string, meta?: object): Promise<void> {
    try {
      const profile = await getCurrentProfile()
      const schoolId = profile?.school_id ?? ''
      if (!schoolId) return
      await DashboardRepository.insertActivityLog({ teacher_id: teacherId, school_id: schoolId, action, meta })
    } catch {
      // fire-and-forget — hata dashboard'u bloke etmez
    }
  },
}
