import { tamamlanmaSatirlari } from '@/src/domains/dashboard/lib/tamamlanma'
import { oran } from '@/src/domains/homework/lib/analitik'
import { DashboardRepository } from '../repositories/DashboardRepository'
import { getCurrentProfile } from '@/src/shared/auth'
import { todayLocalISO } from '@/src/shared/date'
import { logger } from '@/src/infrastructure/observability/logger'
import type { DashboardMetrics, RiskAlert, ClassSummary, HomeworkLite, OdevTamamlanmaItem } from '../types'
import {
  mondayOf as _mondayOf,
  buildHwMissMap,
  buildAbsenceMap,
  computeAlerts,
  computeClassRisk,
  fetchRiskInputs,
  type HwRow,
  type SubmissionRow,
  type StudentRow,
} from '../lib/riskEngine'

export { mondayOf } from '../lib/riskEngine'
export { buildHwMissMap, buildAbsenceMap, computeAlerts } from '../lib/riskEngine'

export const TeacherDashboardService = {
  async getDashboardMetrics(teacherId: string): Promise<DashboardMetrics> {
    const today = todayLocalISO()

    const profile  = await getCurrentProfile()
    if (!profile?.school_id) throw new Error('Profil bulunamadı')
    const schoolId = profile.school_id

    const { homeworks, submissions, attendanceRows, students } =
      await fetchRiskInputs(teacherId, schoolId)

    return {
      homeworks: homeworks as HomeworkLite[],
      tamamlanmaData: tamamlanmaSatirlari(homeworks, submissions, today),
      // en az bir öğrencisi işaretlenmiş ödevler = kontrol edilmiş
      kontrolEdilenHwIds: [...new Set(submissions.map(s => s.homework_id))],
      riskAlerts: computeAlerts(homeworks, submissions, attendanceRows, students),
    }
  },

  async getRiskAlerts(teacherId: string): Promise<RiskAlert[]> {
    const profile  = await getCurrentProfile()
    if (!profile?.school_id) {
      logger.warn({ teacherId }, 'getRiskAlerts: profil veya school_id bulunamadı')
      return []
    }
    const schoolId = profile.school_id
    const { homeworks, submissions, attendanceRows, students } =
      await fetchRiskInputs(teacherId, schoolId)
    return computeAlerts(homeworks, submissions, attendanceRows, students)
  },

  async getClassSummary(classId: string, teacherId: string): Promise<ClassSummary | null> {
    const { subDays } = await import('@/src/shared/date')
    const { turkeyDate } = await import('@/src/lib/email-utils')
    const twoWeeksAgo = turkeyDate(subDays(new Date(), 14))
    const profile     = await getCurrentProfile()
    if (!profile?.school_id) {
      logger.warn({ teacherId, classId }, 'getClassSummary: profil veya school_id bulunamadı')
      return null
    }
    const schoolId    = profile.school_id

    const [subsResult, studentsResult, attResult] = await Promise.all([
      DashboardRepository.getClassSubmissions(classId, teacherId, schoolId),
      DashboardRepository.getStudentsByClasses([classId], schoolId),
      DashboardRepository.getAttendanceRows([classId], teacherId, twoWeeksAgo, schoolId),
    ])

    if ('error' in subsResult     && subsResult.error)     logger.error({ classId, teacherId, code: (subsResult.error as { code?: string }).code }, 'getClassSummary: submission sorgusu başarısız')
    if ('error' in studentsResult && studentsResult.error) logger.error({ classId, code: (studentsResult.error as { code?: string }).code }, 'getClassSummary: öğrenci sorgusu başarısız')
    if ('error' in attResult      && attResult.error)      logger.error({ classId, teacherId, code: (attResult.error as { code?: string }).code }, 'getClassSummary: yoklama sorgusu başarısız')

    const submissions    = (subsResult.data    ?? []) as SubmissionRow[]
    const students       = (studentsResult.data ?? []) as StudentRow[]
    const attendanceRows = (attResult.data      ?? []) as { student_id: string; status: string }[]

    if (students.length === 0) return null

    // Tek tanım (analitik ile aynı): yapıldı / (işaretli − mazeretli); hiç kontrol yoksa null
    const avgCompletionPct = oran(
      submissions.filter(s => s.status === 'yapildi').length,
      submissions.length,
      submissions.filter(s => s.status === 'mazeretli').length,
    )
    const totalMissingCount = submissions.filter(s => s.status === 'eksik').length

    const alerts = computeClassRisk(submissions, attendanceRows, students)
    const riskyStudents = alerts.filter(a => a.riskLevel !== 'low')
    const highRiskCount = alerts.filter(a => a.riskLevel === 'high').length

    return { avgCompletionPct, highRiskCount, totalMissingCount, riskyStudents }
  },

  async logActivity(teacherId: string, action: string, meta?: Record<string, unknown>): Promise<void> {
    try {
      const profile = await getCurrentProfile()
      const schoolId = profile?.school_id ?? ''
      if (!schoolId) return
      await DashboardRepository.insertActivityLog({ teacher_id: teacherId, school_id: schoolId, action, meta })
    } catch (err) {
      logger.warn({ event: 'activity_log_failed', teacherId, action, err }, 'Aktivite logu kaydedilemedi')
    }
  },
}
