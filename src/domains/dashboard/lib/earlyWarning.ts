import { startOfWeek, format } from '@/src/shared/date'
import type {
  AbsenceTrendPoint, ActivityTrendPoint, CoverageTrendPoint, ClassAbsence,
} from './trendMath'

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

const ABSENCE_RISE  = 0.03
const COVERAGE_DROP = 0.10
const ACTIVITY_DROP = 0.15
const SEVERITY_X    = 2

const pct = (x: number) => Math.round(x * 100)

function severityFor(delta: number, threshold: number): 'dikkat' | 'yuksek' {
  return Math.abs(delta) >= threshold * SEVERITY_X ? 'yuksek' : 'dikkat'
}

export function computeEarlyWarnings(
  absence: AbsenceTrendPoint[],
  activity: ActivityTrendPoint[],
  coverage: CoverageTrendPoint[],
  _classAbsence: ClassAbsence[],
  now: Date = new Date(),
): EarlyWarning[] {
  const out: EarlyWarning[] = []
  const realWeeks = new Set(absence.filter(p => p.total > 0).map(p => p.weekStart))

  const a = selectTrendWindow(absence, realWeeks, now)
  if (a && a.last >= a.baselineMean + ABSENCE_RISE) {
    const d = a.last - a.baselineMean
    out.push({
      id: 'absence-rise', metric: 'devamsizlik', severity: severityFor(d, ABSENCE_RISE),
      title: 'Devamsızlık yükseliyor',
      detail: `Son hafta %${pct(a.last)} · dönem ort. %${pct(a.baselineMean)} (+${pct(d)} puan)`,
    })
  }

  const c = selectTrendWindow(coverage, realWeeks, now)
  if (c && c.last <= c.baselineMean - COVERAGE_DROP) {
    const d = c.baselineMean - c.last
    out.push({
      id: 'coverage-drop', metric: 'kapsama', severity: severityFor(d, COVERAGE_DROP),
      title: 'Yoklama kapsama düşüyor',
      detail: `Son hafta %${pct(c.last)} · dönem ort. %${pct(c.baselineMean)} (−${pct(d)} puan)`,
    })
  }

  const t = selectTrendWindow(activity, realWeeks, now)
  if (t && t.last <= t.baselineMean - ACTIVITY_DROP) {
    const d = t.baselineMean - t.last
    out.push({
      id: 'activity-drop', metric: 'aktivite', severity: severityFor(d, ACTIVITY_DROP),
      title: 'Öğretmen aktivitesi düşüyor',
      detail: `Son hafta %${pct(t.last)} · dönem ort. %${pct(t.baselineMean)} (−${pct(d)} puan)`,
    })
  }

  const order = { yuksek: 0, dikkat: 1 } as const
  return out.sort((x, y) => order[x.severity] - order[y.severity])
}
