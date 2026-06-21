// src/domains/dashboard/lib/trendMath.ts
import { startOfWeek, addDays, parseISO, format } from '@/src/shared/date'

export type AbsenceTrendPoint = { weekStart: string; label: string; rate: number; absent: number; total: number }
export type ActivityTrendPoint = { weekStart: string; label: string; rate: number; active: number; total: number }
export type ClassAbsence = { classId: string; name: string; grade: number; rate: number; absent: number; total: number }
export type CoverageTrendPoint = { weekStart: string; label: string; rate: number; recorded: number; expected: number }

function isoWeekStart(dateStr: string): string {
  return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

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
  rows: { date: string; status: string }[], startISO: string, end: Date,
): AbsenceTrendPoint[] {
  const absent = new Map<string, number>()
  const total = new Map<string, number>()
  for (const r of rows) {
    const wk = isoWeekStart(r.date)
    total.set(wk, (total.get(wk) ?? 0) + 1)
    if (r.status === 'absent') absent.set(wk, (absent.get(wk) ?? 0) + 1)
  }
  return weekKeysBetween(startISO, end).map(wk => {
    const t = total.get(wk) ?? 0
    const a = absent.get(wk) ?? 0
    return { weekStart: wk, label: weekLabel(wk), absent: a, total: t, rate: t === 0 ? 0 : a / t }
  })
}

export function computeActivityTrend(
  att: { date: string; teacher_id: string | null }[],
  hw: { assigned_date: string; teacher_id: string | null }[],
  totalTeachers: number, startISO: string, end: Date,
): ActivityTrendPoint[] {
  const byWeek = new Map<string, Set<string>>()
  const add = (dateStr: string, tid: string | null) => {
    if (!tid) return
    const wk = isoWeekStart(dateStr)
    if (!byWeek.has(wk)) byWeek.set(wk, new Set())
    byWeek.get(wk)!.add(tid)
  }
  for (const r of att) add(r.date, r.teacher_id)
  for (const r of hw) add(r.assigned_date, r.teacher_id)
  return weekKeysBetween(startISO, end).map(wk => {
    const active = byWeek.get(wk)?.size ?? 0
    return {
      weekStart: wk, label: weekLabel(wk), active, total: totalTeachers,
      rate: totalTeachers === 0 ? 0 : active / totalTeachers,
    }
  })
}

export function computeClassAbsence(
  rows: { class_id: string; status: string }[],
  classes: { id: string; name: string; grade: number }[],
): ClassAbsence[] {
  const absent = new Map<string, number>()
  const total = new Map<string, number>()
  for (const r of rows) {
    total.set(r.class_id, (total.get(r.class_id) ?? 0) + 1)
    if (r.status === 'absent') absent.set(r.class_id, (absent.get(r.class_id) ?? 0) + 1)
  }
  return classes
    .filter(c => (total.get(c.id) ?? 0) > 0)
    .map(c => {
      const t = total.get(c.id)!
      const a = absent.get(c.id) ?? 0
      return { classId: c.id, name: c.name, grade: c.grade, absent: a, total: t, rate: a / t }
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
 */
export function computeCoverageTrend(
  rows: { date: string; class_id: string }[],
  classCount: number, startISO: string, end: Date,
): CoverageTrendPoint[] {
  const seen = new Map<string, Set<string>>()
  for (const r of rows) {
    const wk = isoWeekStart(r.date)
    if (!seen.has(wk)) seen.set(wk, new Set())
    seen.get(wk)!.add(`${r.class_id}|${r.date}`)
  }
  return weekKeysBetween(startISO, end).map(wk => {
    const weekStartDate = parseISO(wk)
    const weekEnd = addDays(weekStartDate, 6)
    const rangeEnd = weekEnd.getTime() < end.getTime() ? weekEnd : end
    const expected = classCount * weekdaysInRange(weekStartDate, rangeEnd)
    const recorded = seen.get(wk)?.size ?? 0
    return {
      weekStart: wk, label: weekLabel(wk), recorded, expected,
      rate: expected === 0 ? 0 : recorded / expected,
    }
  })
}

export function filledWeekCount(points: { total: number }[]): number {
  return points.filter(p => p.total > 0).length
}
