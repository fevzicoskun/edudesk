// src/domains/dashboard/lib/trendMath.ts
import { startOfWeek, addDays, parseISO, format } from '@/src/shared/date'

export type AbsenceTrendPoint = { weekStart: string; label: string; rate: number; absent: number; total: number }
export type ActivityTrendPoint = { weekStart: string; label: string; rate: number; active: number; total: number }
export type ClassAbsence = { classId: string; name: string; grade: number; rate: number; absent: number; total: number }
export type CoverageTrendPoint = { weekStart: string; label: string; rate: number; recorded: number; expected: number }

// DB-tarafı RPC çıktı satırları (get_school_* fonksiyonları). Hafta (Pzt) ve sınıf
// grenine indirgenmiş agregatlar — ham yoklama satırı değil.
export type AttendanceWeekRow = { week_start: string; total: number; absent: number; recorded: number }
export type ActivityWeekRow = { week_start: string; active: number }
export type ClassAbsenceRow = { class_id: string; total: number; absent: number }

/** Pazartesi-başlı hafta anahtarları; start ve end'in haftaları dahil. */
export function weekKeysBetween(startISO: string, end: Date): string[] {
  let cur = startOfWeek(parseISO(startISO), { weekStartsOn: 1 })
  const last = startOfWeek(end, { weekStartsOn: 1 })
  const out: string[] = []
  while (cur.getTime() <= last.getTime()) {
    out.push(format(cur, 'yyyy-MM-dd'))
    cur = addDays(cur, 7)
  }
  return out
}

function weekLabel(weekStartISO: string): string {
  return format(parseISO(weekStartISO), 'd MMM')
}

export function computeAbsenceTrend(
  rows: { week_start: string; total: number; absent: number }[], startISO: string, end: Date,
): AbsenceTrendPoint[] {
  const byWeek = new Map(rows.map(r => [r.week_start, r]))
  return weekKeysBetween(startISO, end).map(wk => {
    const r = byWeek.get(wk)
    const t = r?.total ?? 0
    const a = r?.absent ?? 0
    return { weekStart: wk, label: weekLabel(wk), absent: a, total: t, rate: t === 0 ? 0 : a / t }
  })
}

export function computeActivityTrend(
  rows: ActivityWeekRow[], totalTeachers: number, startISO: string, end: Date,
): ActivityTrendPoint[] {
  const byWeek = new Map(rows.map(r => [r.week_start, r.active]))
  return weekKeysBetween(startISO, end).map(wk => {
    const active = byWeek.get(wk) ?? 0
    return {
      weekStart: wk, label: weekLabel(wk), active, total: totalTeachers,
      rate: totalTeachers === 0 ? 0 : active / totalTeachers,
    }
  })
}

export function computeClassAbsence(
  rows: ClassAbsenceRow[],
  classes: { id: string; name: string; grade: number }[],
): ClassAbsence[] {
  const byClass = new Map(rows.map(r => [r.class_id, r]))
  return classes
    .filter(c => (byClass.get(c.id)?.total ?? 0) > 0)
    .map(c => {
      const r = byClass.get(c.id)!
      return { classId: c.id, name: c.name, grade: c.grade, absent: r.absent, total: r.total, rate: r.absent / r.total }
    })
    .sort((x, y) => y.rate - x.rate)
}

/** [start, end] aralığındaki hafta içi (Pzt–Cum) gün sayısı. */
function weekdaysInRange(start: Date, end: Date): number {
  let n = 0
  let cur = start
  while (cur.getTime() <= end.getTime()) {
    const dow = cur.getDay() // 0 Paz .. 6 Cmt
    if (dow >= 1 && dow <= 5) n++
    cur = addDays(cur, 1)
  }
  return n
}

/**
 * Yoklama kapsama trendi (haftalık): alınan (sınıf, gün) yoklamalarının
 * beklenene oranı. Beklenen = sınıf sayısı × o haftanın bugüne kadarki hafta
 * içi günü. Akademik takvim yok → tatiller hafta içi sayılır (bilinen tavan).
 * `recorded` distinct (sınıf,gün) sayısı RPC'den hazır gelir.
 */
export function computeCoverageTrend(
  rows: { week_start: string; recorded: number }[],
  classCount: number, startISO: string, end: Date,
): CoverageTrendPoint[] {
  const byWeek = new Map(rows.map(r => [r.week_start, r.recorded]))
  return weekKeysBetween(startISO, end).map(wk => {
    const weekStartDate = parseISO(wk)
    const weekEnd = addDays(weekStartDate, 6)
    const rangeEnd = weekEnd.getTime() < end.getTime() ? weekEnd : end
    const expected = classCount * weekdaysInRange(weekStartDate, rangeEnd)
    const recorded = byWeek.get(wk) ?? 0
    return {
      weekStart: wk, label: weekLabel(wk), recorded, expected,
      rate: expected === 0 ? 0 : recorded / expected,
    }
  })
}

export function filledWeekCount(points: { total: number }[]): number {
  return points.filter(p => p.total > 0).length
}
