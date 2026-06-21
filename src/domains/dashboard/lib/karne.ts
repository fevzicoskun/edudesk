import { currentWeekStart, computeEarlyWarnings, type EarlyWarning } from './earlyWarning'
import type {
  AbsenceTrendPoint, ActivityTrendPoint, CoverageTrendPoint, ClassAbsence,
} from './trendMath'

export type KarneMetric = { sonHafta: number; donemOrt: number }

export type KarneData = {
  schoolName: string
  donemStart: string
  generatedAt: string
  metrics: {
    devamsizlik: KarneMetric
    kapsama:     KarneMetric
    aktivite:    KarneMetric
  }
  classAbsence: { name: string; grade: number; rate: number }[]
  warnings: EarlyWarning[]
}

function metricSummary(
  points: { weekStart: string; rate: number }[],
  realWeeks: Set<string>,
  now: Date,
): KarneMetric {
  const cw = currentWeekStart(now)
  const usable = points.filter(p => realWeeks.has(p.weekStart) && p.weekStart < cw)
  if (usable.length === 0) return { sonHafta: 0, donemOrt: 0 }
  const sonHafta = Math.round(usable[usable.length - 1].rate * 100)
  const donemOrt = Math.round((usable.reduce((s, p) => s + p.rate, 0) / usable.length) * 100)
  return { sonHafta, donemOrt }
}

export function buildKarneData(
  schoolName: string,
  donemStart: string,
  absence: AbsenceTrendPoint[],
  activity: ActivityTrendPoint[],
  coverage: CoverageTrendPoint[],
  classAbsence: ClassAbsence[],
  now: Date = new Date(),
): KarneData {
  const realWeeks = new Set(absence.filter(p => p.total > 0).map(p => p.weekStart))
  return {
    schoolName,
    donemStart,
    generatedAt: now.toISOString(),
    metrics: {
      devamsizlik: metricSummary(absence, realWeeks, now),
      kapsama:     metricSummary(coverage, realWeeks, now),
      aktivite:    metricSummary(activity, realWeeks, now),
    },
    classAbsence: classAbsence.map(c => ({ name: c.name, grade: c.grade, rate: Math.round(c.rate * 100) })),
    warnings: computeEarlyWarnings(absence, activity, coverage, classAbsence, now),
  }
}
