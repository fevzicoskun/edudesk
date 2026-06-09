import type { AbsenceCount, AttendanceRow, AttendanceStatus } from '../types'

/** YYYY-MM-DD bir hafta sonu mu? (yerel saat, TZ'den bağımsız parse) */
export function isWeekendISO(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}

/**
 * Devamsızlık sayımı: absent=1, late=0.5 (özürsüz); excused=1 (özürlü).
 * Hafta sonu ve present satırları sayılmaz. Hiç devamsızlığı olmayan
 * öğrenci sonuçta yer almaz.
 */
export function countAbsences(rows: AttendanceRow[]): Record<string, AbsenceCount> {
  const out: Record<string, AbsenceCount> = {}
  for (const r of rows) {
    if (isWeekendISO(r.date)) continue
    if (r.status !== 'absent' && r.status !== 'late' && r.status !== 'excused') continue
    const c = (out[r.student_id] ??= { unexcused: 0, excused: 0 })
    if (r.status === 'excused') c.excused += 1
    else c.unexcused += r.status === 'absent' ? 1 : 0.5
  }
  return out
}

/** Rozet metni: "4g", "3.5g", "4g + 2ö", "2ö" veya '' */
export function formatAbsenceBadge(c: AbsenceCount): string {
  const g = c.unexcused === 0 ? '' : `${c.unexcused % 1 === 0 ? c.unexcused : c.unexcused.toFixed(1)}g`
  const o = c.excused === 0 ? '' : `${c.excused}ö`
  if (g && o) return `${g} + ${o}`
  return g || o
}

/** Ayın Pzt–Cum günleri, ISO (YYYY-MM-DD) listesi. month: 1-12 */
export function schoolDaysOfMonth(year: number, month: number): string[] {
  const days: string[] = []
  const last = new Date(year, month, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0 || dow === 6) continue
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return days
}

/** Çizelge grid'i: öğrenci → tarih → status */
export function buildMonthGrid(rows: AttendanceRow[]): Record<string, Record<string, AttendanceStatus>> {
  const grid: Record<string, Record<string, AttendanceStatus>> = {}
  for (const r of rows) {
    ;(grid[r.student_id] ??= {})[r.date] = r.status as AttendanceStatus
  }
  return grid
}
