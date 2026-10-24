import { DashboardRepository } from '../repositories/DashboardRepository'
import { computeRiskLevel } from '../risk'
import { subDays } from '@/src/shared/date'
import { turkeyDate } from '@/src/lib/email-utils'
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
  // Seviye içinde en ağır önce: ana sayfa ve haftalık mail yalnız ilk 5'i gösterir (canlıda 31 yüksek riskli, 2026-10-11)
  return alerts.sort((a, b) =>
    RISK_SORT_ORDER[a.riskLevel] - RISK_SORT_ORDER[b.riskLevel]
    || b.hwMisses - a.hwMisses
    || b.absences - a.absences)
}

/** Ana sayfa Risk Uyarıları (ve Pazartesi özet maili) eşikleri — değiştirmek için yalnız burası.
 *  Öğrencinin İŞARETLİ son RISK_SON_ODEV ödevinde kaç "yapılmadı" olduğuna bakılır. */
export const RISK_SON_ODEV    = 5
export const RISK_YUKSEK_ESIK = 4 // ≥ bu kadar yapılmadı → Yüksek Risk
export const RISK_ORTA_ESIK   = 3 // ≥ bu kadar yapılmadı → Orta Risk; daha azı listeye girmez

/** homeworks teslim tarihi yeniden eskiye gelir (getTeacherHomeworks). İşaretlenmemiş ödevin satırı yoktur
 *  (submissions yalnız marked_at dolu) → pencereyi doldurmaz; mazeretli (sınıfta yok) da sayılmaz.
 *  Eksik/geç "yapılmadı" değildir. Devamsızlık tek başına listeye sokmaz (ayrı Devamsızlık Riski kartı var). */
export function computeAlerts(
  homeworks:      HwRow[],
  submissions:    SubmissionRow[],
  attendanceRows: { student_id: string; status: string }[],
  students:       StudentRow[],
): RiskAlert[] {
  const sira = new Map(homeworks.map((h, i) => [h.id, i]))
  const ogrenciDurumlari = new Map<string, { sira: number; status: string }[]>()
  for (const s of submissions) {
    const i = sira.get(s.homework_id)
    if (i === undefined || s.status === 'mazeretli') continue
    const liste = ogrenciDurumlari.get(s.student_id) ?? []
    liste.push({ sira: i, status: s.status })
    ogrenciDurumlari.set(s.student_id, liste)
  }
  const absenceMap = buildAbsenceMap(attendanceRows)

  const alerts: RiskAlert[] = []
  for (const student of students) {
    const son = (ogrenciDurumlari.get(student.id) ?? []).sort((a, b) => a.sira - b.sira).slice(0, RISK_SON_ODEV)
    const hwMisses = son.filter(d => d.status === 'yapilmadi').length
    if (hwMisses < RISK_ORTA_ESIK) continue
    const absences = absenceMap.get(student.id) ?? 0
    alerts.push({
      studentId:   student.id,
      studentName: student.full_name,
      classId:     student.class_id,
      className:   student.classes?.name ?? '—',
      riskLevel:   hwMisses >= RISK_YUKSEK_ESIK ? 'high' : 'medium',
      reasons:     [`Son ${son.length} ödevden ${hwMisses} yapılmadı`, ...(absences >= 1 ? [`Son 14 günde ${absences} gün devamsız`] : [])],
      hwMisses,
      absences,
    })
  }
  return alerts.sort((a, b) =>
    RISK_SORT_ORDER[a.riskLevel] - RISK_SORT_ORDER[b.riskLevel]
    || b.hwMisses - a.hwMisses
    || b.absences - a.absences)
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

/** yoklama=false: okulda yoklama modülü kapalı → attendance hiç sorgulanmaz (devamsızlık riski boş). */
export async function fetchRiskInputs(teacherId: string, schoolId: string, sb?: Parameters<typeof DashboardRepository.getSubmissions>[2], yoklama = true) {
  const twoWeeksAgo   = turkeyDate(subDays(new Date(), 14))
  const ninetyDaysAgo = turkeyDate(subDays(new Date(), 90))

  const { data: hwData, error: hwError } = await DashboardRepository.getTeacherHomeworks(teacherId, schoolId, ninetyDaysAgo, sb)
  if (hwError) logger.error({ teacherId, schoolId, code: (hwError as { code?: string }).code }, 'fetchRiskInputs: ödev sorgusu başarısız')
  const homeworks = (hwData ?? []) as HwRow[]
  const hwIds     = homeworks.map(h => h.id)
  const classIds  = [...new Set(homeworks.map(h => h.class_id))]

  const [subsResult, attResult, studentsResult] = await Promise.all([
    DashboardRepository.getSubmissions(hwIds, schoolId, sb),
    yoklama
      ? DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo, schoolId, sb)
      : Promise.resolve({ data: [] as { student_id: string; status: string }[], error: null }),
    DashboardRepository.getStudentsByClasses(classIds, schoolId, sb),
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
