import { startOfWeek, format } from '@/src/shared/date'

export type EarlyWarning = {
  id: string
  severity: 'dikkat' | 'yuksek'
  metric: 'devamsizlik' | 'kapsama' | 'aktivite' | 'sinif'
  title: string
  detail: string
  classId?: string
}

const MIN_BASELINE_WEEKS = 2

function currentWeekStart(now: Date): string {
  return format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

// Son tam (oturumda) hafta + ondan önceki baz haftaların ortalaması.
// Yetersiz baz (<2) ya da son tam hafta yoksa null.
export function selectTrendWindow(
  points: { weekStart: string; rate: number }[],
  realWeeks: Set<string>,
  now: Date,
): { last: number; baselineMean: number; baselineCount: number } | null {
  const cw = currentWeekStart(now)
  const usable = points.filter(p => realWeeks.has(p.weekStart) && p.weekStart < cw)
  if (usable.length < MIN_BASELINE_WEEKS + 1) return null
  const last = usable[usable.length - 1]
  const baseline = usable.slice(0, -1)
  const baselineMean = baseline.reduce((s, p) => s + p.rate, 0) / baseline.length
  return { last: last.rate, baselineMean, baselineCount: baseline.length }
}
