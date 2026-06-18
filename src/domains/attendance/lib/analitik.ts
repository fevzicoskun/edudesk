import { countAbsences, isWeekendISO } from './attendanceMath'
import type { AttendanceRow } from '../types'
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'

export interface AbsenceRowA { student_id: string; status: string; date: string }
export interface StudentA { id: string; class_id: string; full_name: string; student_number: string | null }
export interface ClassA { id: string; name: string; grade: number }
export interface CoverageRpcRow { class_id: string; covered_days: number }

export interface AttendanceKpi {
  totalUnexcused: number
  overLimit:      number
  inWarn:         number
  takenToday:     number
  totalClasses:   number
}

export function computeAttendanceKpi(
  rows: AbsenceRowA[], students: StudentA[], takenToday: number, totalClasses: number,
): AttendanceKpi {
  const counts = countAbsences(rows as AttendanceRow[])
  let totalUnexcused = 0, overLimit = 0, inWarn = 0
  for (const s of students) {
    const u = counts[s.id]?.unexcused ?? 0
    totalUnexcused += u
    if (u >= ATTENDANCE_LIMIT_DAYS) overLimit++
    else if (u >= ATTENDANCE_WARN_DAYS) inWarn++
  }
  return { totalUnexcused, overLimit, inWarn, takenToday, totalClasses }
}

export interface ClassAbsenceStat {
  classId: string; name: string; grade: number; studentCount: number; avgUnexcused: number
}

export function computeClassAbsence(
  rows: AbsenceRowA[], students: StudentA[], classes: ClassA[],
): ClassAbsenceStat[] {
  const counts = countAbsences(rows as AttendanceRow[])
  return classes
    .map(c => {
      const cls = students.filter(s => s.class_id === c.id)
      const total = cls.reduce((sum, s) => sum + (counts[s.id]?.unexcused ?? 0), 0)
      const studentCount = cls.length
      return {
        classId: c.id, name: c.name, grade: c.grade, studentCount,
        avgUnexcused: studentCount > 0 ? total / studentCount : 0,
      }
    })
    .filter(c => c.studentCount > 0)
    .sort((a, b) => b.avgUnexcused - a.avgUnexcused)
}

export interface WeeklyAbsencePoint { weekStart: string; rate: number }

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mondayISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - dow)
  return fmtDate(dt)
}

export function computeWeeklyAbsenceTrend(
  rows: AbsenceRowA[], studentCount: number, weeks = 8,
): WeeklyAbsencePoint[] {
  const today = new Date()
  const todayDow = (today.getDay() + 6) % 7
  const thisMon = new Date(today)
  thisMon.setDate(today.getDate() - todayDow)

  const buckets: { weekStart: string; unexcused: number }[] = []
  const index = new Map<string, number>()
  for (let i = weeks - 1; i >= 0; i--) {
    const m = new Date(thisMon)
    m.setDate(thisMon.getDate() - i * 7)
    const ws = fmtDate(m)
    index.set(ws, buckets.length)
    buckets.push({ weekStart: ws, unexcused: 0 })
  }

  for (const r of rows) {
    if (isWeekendISO(r.date)) continue
    if (r.status !== 'absent' && r.status !== 'late') continue
    const idx = index.get(mondayISO(r.date))
    if (idx === undefined) continue
    buckets[idx].unexcused += r.status === 'absent' ? 1 : 0.5
  }

  // ponytail: haftalık payda = studentCount × 5 okul günü (tatiller yok sayılır);
  // trend yönü için yeterli, gerçek okul-günü gerekirse pencere başına hesaplanır.
  const denomPerWeek = studentCount * 5
  return buckets.map(b => ({
    weekStart: b.weekStart,
    rate: denomPerWeek > 0 ? Math.round((b.unexcused / denomPerWeek) * 100) : 0,
  }))
}

export interface ChronicAbsentee {
  studentId: string; name: string; classId: string; className: string; unexcused: number; level: 'warn' | 'danger'
}

export function computeChronicAbsentees(
  rows: AbsenceRowA[], students: StudentA[], classes: ClassA[], warnDays: number,
): ChronicAbsentee[] {
  const counts = countAbsences(rows as AttendanceRow[])
  const classMap = new Map(classes.map(c => [c.id, c.name]))
  const out: ChronicAbsentee[] = []
  for (const s of students) {
    const u = counts[s.id]?.unexcused ?? 0
    if (u < warnDays) continue
    out.push({
      studentId: s.id, name: s.full_name, classId: s.class_id,
      className: classMap.get(s.class_id) ?? '—',
      unexcused: u, level: u >= ATTENDANCE_LIMIT_DAYS ? 'danger' : 'warn',
    })
  }
  return out.sort((a, b) => b.unexcused - a.unexcused)
}

export interface CoverageStat { classId: string; name: string; coveragePct: number }

export function computeCoverage(rpcRows: CoverageRpcRow[], classes: ClassA[]): CoverageStat[] {
  if (rpcRows.length === 0) return []
  const schoolDays = Math.max(...rpcRows.map(r => r.covered_days))
  if (schoolDays === 0) return []
  const nameMap = new Map(classes.map(c => [c.id, c.name]))
  const out: CoverageStat[] = []
  for (const r of rpcRows) {
    const name = nameMap.get(r.class_id)
    if (!name) continue
    out.push({ classId: r.class_id, name, coveragePct: Math.round((r.covered_days / schoolDays) * 100) })
  }
  return out.sort((a, b) => a.coveragePct - b.coveragePct)
}
