import { DashboardRepository } from '../repositories/DashboardRepository'
import { computeRiskLevel } from '../risk'
import { subDays } from '@/src/shared/date'
import { turkeyDate } from '@/src/lib/email-utils'
import { RISK_HW_LOOKBACK } from '@/src/shared/constants/limits'
import { logger } from '@/src/infrastructure/observability/logger'
import type { RiskAlert } from '../types'

export type StudentRow   = { id: string; full_name: string; class_id: string; classes: { name: string } | null }
export type SubmissionRow = { homework_id: string; student_id: string; status: string }
export type HwRow        = { id: string; title: string; subject: string; due_date: string; class_id: string; classes: { name: string; grade: number } | null }

export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getWeekStart(): string {
  const nowTR = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const d = new Date(nowTR)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`
}

const RISK_SORT_ORDER = { high: 0, medium: 1, low: 2 } as const

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
  hwMissMap:  Map<string, number>,
  absenceMap: Map<string, number>,
  students:   StudentRow[],
  reasonFmt:  (hwMisses: number, absences: number) => string[],
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

export function computeClassRisk(
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

export async function fetchRiskInputs(teacherId: string, schoolId: string) {
  const twoWeeksAgo   = turkeyDate(subDays(new Date(), 14))
  const ninetyDaysAgo = turkeyDate(subDays(new Date(), 90))

  const { data: hwData, error: hwError } = await DashboardRepository.getTeacherHomeworks(teacherId, schoolId, ninetyDaysAgo)
  if (hwError) logger.error({ teacherId, schoolId, code: (hwError as { code?: string }).code }, 'fetchRiskInputs: ödev sorgusu başarısız')
  const homeworks = (hwData ?? []) as HwRow[]
  const hwIds     = homeworks.map(h => h.id)
  const classIds  = [...new Set(homeworks.map(h => h.class_id))]

  const [subsResult, attResult, studentsResult] = await Promise.all([
    DashboardRepository.getSubmissions(hwIds),
    DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
    DashboardRepository.getStudentsByClasses(classIds, schoolId),
  ])

  if ('error' in subsResult     && subsResult.error)     logger.error({ teacherId, hwCount: hwIds.length, code: (subsResult.error as { code?: string }).code }, 'fetchRiskInputs: submission sorgusu başarısız')
  if ('error' in attResult      && attResult.error)      logger.error({ teacherId, classCount: classIds.length, code: (attResult.error as { code?: string }).code }, 'fetchRiskInputs: yoklama sorgusu başarısız')
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
