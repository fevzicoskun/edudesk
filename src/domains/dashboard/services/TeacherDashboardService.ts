import { DashboardRepository } from '../repositories/DashboardRepository'
import { computeRiskLevel } from '../risk'
import { getCurrentProfile } from '@/src/shared/auth'
import { subDays, todayLocalISO } from '@/src/shared/date'
import { turkeyDate } from '@/src/lib/email-utils'
import { RISK_HW_LOOKBACK } from '@/src/shared/constants/limits'
import { logger } from '@/src/infrastructure/observability/logger'
import type { DashboardMetrics, RiskAlert, ClassSummary, HomeworkLite, OdevTamamlanmaItem, YoklamaTrendItem, YoklamaDurumItem } from '../types'

export function mondayOf(dateStr: string): string {
  // Yerel tarih constructor kullan — toISOString UTC kaymasını önle
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function shortLabel(isoDate: string): string {
  const d = new Date(isoDate)
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

type StudentRow = { id: string; full_name: string; class_id: string; classes: { name: string } | null }
type SubmissionRow = { homework_id: string; student_id: string; status: string }
type HwRow = { id: string; title: string; subject: string; due_date: string; class_id: string; classes: { name: string; grade: number } | null }

function getWeekStart(): string {
  // Europe/Istanbul'da Pazartesi'yi bul
  const nowTR = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const d = new Date(nowTR)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`
}

const RISK_SORT_ORDER = { high: 0, medium: 1, low: 2 } as const

// Öğrenci bazında ödev eksikliği sayısını hesaplar.
// limitToHwIds verilirse sadece o ödev kimliklerindeki eksikler sayılır (son N ödev filtresi).
export function buildHwMissMap(
  submissions: SubmissionRow[],
  limitToHwIds?: Set<string>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const sub of submissions) {
    if (limitToHwIds && !limitToHwIds.has(sub.homework_id)) continue
    if (sub.status === 'eksik' || sub.status === 'yapilmadi' || sub.status === 'gec') {
      map.set(sub.student_id, (map.get(sub.student_id) ?? 0) + 1)
    }
  }
  return map
}

export function buildAbsenceMap(attendanceRows: { student_id: string; status: string }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const att of attendanceRows) {
    if (att.status === 'absent') map.set(att.student_id, (map.get(att.student_id) ?? 0) + 1)
  }
  return map
}

function buildRiskAlerts(
  hwMissMap:   Map<string, number>,
  absenceMap:  Map<string, number>,
  students:    StudentRow[],
  reasonFmt:   (hwMisses: number, absences: number) => string[],
): RiskAlert[] {
  const alerts: RiskAlert[] = []
  for (const student of students) {
    const hwMisses = hwMissMap.get(student.id) ?? 0
    const absences = absenceMap.get(student.id) ?? 0
    if (hwMisses === 0 && absences === 0) continue
    alerts.push({
      studentId:   student.id,
      studentName: student.full_name,
      classId:     student.class_id,
      className:   student.classes?.name ?? '—',
      riskLevel:   computeRiskLevel(hwMisses, absences),
      reasons:     reasonFmt(hwMisses, absences),
      hwMisses,
      absences,
    })
  }
  return alerts.sort((a, b) => RISK_SORT_ORDER[a.riskLevel] - RISK_SORT_ORDER[b.riskLevel])
}

export function computeAlerts(
  homeworks:      HwRow[],
  submissions:    SubmissionRow[],
  attendanceRows: { student_id: string; status: string }[],
  students:       StudentRow[],
): RiskAlert[] {
  // Son RISK_HW_LOOKBACK ödev/sınıf bazında filtrele
  const limitHwIds = new Set<string>()
  const lastHwByClass = new Map<string, number>()
  for (const hw of homeworks) {
    const seen = lastHwByClass.get(hw.class_id) ?? 0
    if (seen < RISK_HW_LOOKBACK) {
      limitHwIds.add(hw.id)
      lastHwByClass.set(hw.class_id, seen + 1)
    }
  }
  return buildRiskAlerts(
    buildHwMissMap(submissions, limitHwIds),
    buildAbsenceMap(attendanceRows),
    students,
    (hw, ab) => [
      ...(hw >= 1 ? [`Son ${RISK_HW_LOOKBACK} ödevde ${hw} eksik`] : []),
      ...(ab >= 1 ? [`Son 14 günde ${ab} gün devamsız`]           : []),
    ],
  )
}

function computeClassRisk(
  submissions:    SubmissionRow[],
  attendanceRows: { student_id: string; status: string }[],
  students:       StudentRow[],
): RiskAlert[] {
  return buildRiskAlerts(
    buildHwMissMap(submissions),
    buildAbsenceMap(attendanceRows),
    students,
    (hw, ab) => [
      ...(hw >= 1 ? [`${hw} eksik ödev`]               : []),
      ...(ab >= 1 ? [`Son 14 günde ${ab} gün devamsız`] : []),
    ],
  )
}

async function fetchRiskInputs(teacherId: string, schoolId: string) {
  const twoWeeksAgo   = turkeyDate(subDays(new Date(), 14))
  const ninetyDaysAgo = turkeyDate(subDays(new Date(), 90))

  const { data: hwData, error: hwError } = await DashboardRepository.getTeacherHomeworks(teacherId, schoolId, ninetyDaysAgo)
  if (hwError) logger.error({ teacherId, schoolId, code: (hwError as { code?: string }).code }, 'fetchRiskInputs: ödev sorgusu başarısız')
  const homeworks  = (hwData ?? []) as HwRow[]
  const hwIds      = homeworks.map(h => h.id)
  const classIds   = [...new Set(homeworks.map(h => h.class_id))]

  const [subsResult, attResult, studentsResult] = await Promise.all([
    DashboardRepository.getSubmissions(hwIds),
    DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
    DashboardRepository.getStudentsByClasses(classIds),
  ])

  if ('error' in subsResult    && subsResult.error)    logger.error({ teacherId, hwCount: hwIds.length, code: (subsResult.error as { code?: string }).code }, 'fetchRiskInputs: submission sorgusu başarısız')
  if ('error' in attResult     && attResult.error)     logger.error({ teacherId, classCount: classIds.length, code: (attResult.error as { code?: string }).code }, 'fetchRiskInputs: yoklama sorgusu başarısız')
  if ('error' in studentsResult && studentsResult.error) logger.error({ teacherId, classCount: classIds.length, code: (studentsResult.error as { code?: string }).code }, 'fetchRiskInputs: öğrenci sorgusu başarısız')

  return {
    homeworks,
    hwIds,
    classIds,
    submissions:    (subsResult.data    ?? []) as SubmissionRow[],
    attendanceRows: (attResult.data      ?? []) as { student_id: string; status: string }[],
    students:       (studentsResult.data ?? []) as StudentRow[],
  }
}

export const TeacherDashboardService = {
  async getDashboardMetrics(teacherId: string): Promise<DashboardMetrics> {
    const today         = todayLocalISO()
    const eightWeeksAgo = turkeyDate(subDays(new Date(), 56))
    const weekStart     = getWeekStart()

    const profile  = await getCurrentProfile()
    if (!profile?.school_id) throw new Error('Profil bulunamadı')
    const schoolId = profile.school_id

    // Aşama 1: risk verisi (hwIds ve classIds buradan geliyor)
    const { homeworks, hwIds, classIds, submissions, attendanceRows, students } =
      await fetchRiskInputs(teacherId, schoolId)

    // Aşama 2: hwIds/classIds gerektiren diğer 3 sorgu
    const [weeklyResult, trendResult, todayAttResult] = await Promise.all([
      DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
      DashboardRepository.getAttendanceTrend(classIds, eightWeeksAgo),
      DashboardRepository.getTodayClassAttendance(classIds, today),
    ])

    const classesWithAttToday = new Set((todayAttResult.data ?? []).map(a => (a as { class_id: string }).class_id))
    const weeklySubmissions   = (weeklyResult.data ?? []) as SubmissionRow[]
    const trendRows           = (trendResult.data  ?? []) as { date: string; status: string }[]

    const todayHomeworkCount = homeworks.filter(h => h.due_date === today).length
    const totalMissingCount  = submissions.filter(s => s.status === 'eksik').length

    const alerts = computeAlerts(homeworks, submissions, attendanceRows, students)
    const activeRiskCount = alerts.filter(a => a.riskLevel !== 'low').length

    const weeklyDoneCount = weeklySubmissions.filter(s => s.status === 'yapildi').length
    const avgCompletionPct = weeklySubmissions.length > 0
      ? Math.round((weeklyDoneCount / weeklySubmissions.length) * 100)
      : 0

    // Ödev tamamlanma chart: son 6 geçmiş ödev
    const pastHws = homeworks.filter(h => h.due_date <= today).slice(0, 6)
    const subByHw = new Map<string, { yapildi: number; eksik: number; diger: number; toplam: number }>()
    for (const hw of pastHws) subByHw.set(hw.id, { yapildi: 0, eksik: 0, diger: 0, toplam: 0 })
    for (const s of submissions) {
      const e = subByHw.get(s.homework_id)
      if (!e) continue
      e.toplam++
      if      (s.status === 'yapildi') e.yapildi++
      else if (s.status === 'eksik')   e.eksik++
      else                              e.diger++
    }
    const tamamlanmaData: OdevTamamlanmaItem[] = [...pastHws].reverse().map(hw => {
      const s = subByHw.get(hw.id)!
      const t = s.toplam
      const title = hw.title.length > 14 ? hw.title.slice(0, 13) + '…' : hw.title
      return {
        title,
        yapildi: t > 0 ? Math.round((s.yapildi / t) * 100) : 0,
        eksik:   t > 0 ? Math.round((s.eksik   / t) * 100) : 0,
        diger:   t > 0 ? Math.round((s.diger   / t) * 100) : 0,
      }
    })

    // Yoklama trend chart: son 8 hafta
    const weekMap = new Map<string, { devamsiz: number; toplam: number }>()
    for (const r of trendRows) {
      const key = mondayOf(r.date)
      if (!weekMap.has(key)) weekMap.set(key, { devamsiz: 0, toplam: 0 })
      const e = weekMap.get(key)!
      e.toplam++
      if (r.status === 'absent') e.devamsiz++
    }
    const yoklamaTrendData: YoklamaTrendItem[] = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, { devamsiz, toplam }]) => ({
        hafta: shortLabel(week),
        oran:  toplam > 0 ? Math.round((devamsiz / toplam) * 100) : 0,
        devamsiz,
        toplam,
      }))

    // Öğretmenin sınıflarını unique listele, grade+name'e göre sırala
    const seenClasses = new Map<string, { classId: string; className: string; grade: number }>()
    for (const hw of homeworks) {
      if (!seenClasses.has(hw.class_id)) {
        seenClasses.set(hw.class_id, {
          classId:   hw.class_id,
          className: hw.classes?.name ?? '—',
          grade:     hw.classes?.grade ?? 0,
        })
      }
    }
    const yoklamaDurumu: YoklamaDurumItem[] = [...seenClasses.values()]
      .sort((a, b) => a.grade - b.grade || a.className.localeCompare(b.className, 'tr'))
      .map(c => ({ ...c, alindi: classesWithAttToday.has(c.classId) }))

    return {
      todayHomeworkCount,
      totalMissingCount,
      activeRiskCount,
      weekly: {
        submittedCount: weeklyDoneCount,
        avgCompletionPct,
        activeRiskCount: activeRiskCount,
      },
      homeworks: homeworks as HomeworkLite[],
      tamamlanmaData,
      yoklamaTrendData,
      yoklamaDurumu,
      riskAlerts: alerts,
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
    const twoWeeksAgo = turkeyDate(subDays(new Date(), 14))
    const profile     = await getCurrentProfile()
    if (!profile?.school_id) {
      logger.warn({ teacherId, classId }, 'getClassSummary: profil veya school_id bulunamadı')
      return null
    }
    const schoolId    = profile.school_id

    const [subsResult, studentsResult, attResult] = await Promise.all([
      DashboardRepository.getClassSubmissions(classId, teacherId, schoolId),
      DashboardRepository.getStudentsByClasses([classId]),
      DashboardRepository.getAttendanceRows([classId], teacherId, twoWeeksAgo),
    ])

    if ('error' in subsResult    && subsResult.error)    logger.error({ classId, teacherId, code: (subsResult.error as { code?: string }).code }, 'getClassSummary: submission sorgusu başarısız')
    if ('error' in studentsResult && studentsResult.error) logger.error({ classId, code: (studentsResult.error as { code?: string }).code }, 'getClassSummary: öğrenci sorgusu başarısız')
    if ('error' in attResult     && attResult.error)     logger.error({ classId, teacherId, code: (attResult.error as { code?: string }).code }, 'getClassSummary: yoklama sorgusu başarısız')

    const submissions    = (subsResult.data    ?? []) as SubmissionRow[]
    const students       = (studentsResult.data ?? []) as StudentRow[]
    const attendanceRows = (attResult.data      ?? []) as { student_id: string; status: string }[]

    if (students.length === 0) return null

    const doneCount = submissions.filter(s => s.status === 'yapildi').length
    const avgCompletionPct = submissions.length > 0
      ? Math.round((doneCount / submissions.length) * 100)
      : 0
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
