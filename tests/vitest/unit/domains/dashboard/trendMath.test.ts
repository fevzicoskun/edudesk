// tests/vitest/unit/domains/dashboard/trendMath.test.ts
import { describe, it, expect } from 'vitest'
import {
  weekKeysBetween, computeAbsenceTrend, computeActivityTrend,
  computeClassAbsence, computeCoverageTrend, filledWeekCount,
} from '@/src/domains/dashboard/lib/trendMath'

// NOT: Hafta-bucketing ve distinct-öğretmen union mantığı artık DB-tarafı RPC'lerde
// (get_school_*). Bu testler RPC'den gelen agregat satırlarını alıp takvim/oran/etiket
// mantığını doğrular. Bucketing/union doğruluğu integration katmanında kapsanır.

describe('weekKeysBetween', () => {
  it('returns Monday-anchored weeks inclusive of start and end', () => {
    // 2026-05-05 is a Tuesday -> week of Mon 2026-05-04
    const keys = weekKeysBetween('2026-05-05', new Date('2026-05-20T12:00:00'))
    expect(keys).toEqual(['2026-05-04', '2026-05-11', '2026-05-18'])
  })
})

describe('computeAbsenceTrend', () => {
  const rows = [
    { week_start: '2026-05-04', total: 4, absent: 1, recorded: 4 },
    { week_start: '2026-05-11', total: 2, absent: 2, recorded: 2 },
  ]
  const points = computeAbsenceTrend(rows, '2026-05-04', new Date('2026-05-12T12:00:00'))

  it('produces one point per calendar week', () => {
    expect(points.map(p => p.weekStart)).toEqual(['2026-05-04', '2026-05-11'])
  })
  it('uses absent in numerator, total in denominator', () => {
    expect(points[0]).toMatchObject({ absent: 1, total: 4, rate: 0.25 })
    expect(points[1]).toMatchObject({ absent: 2, total: 2, rate: 1 })
  })
  it('emits rate 0 for a week absent from the RPC rows (gap week)', () => {
    const gap = computeAbsenceTrend(
      [{ week_start: '2026-05-04', total: 1, absent: 1 }],
      '2026-05-04', new Date('2026-05-18T12:00:00'),
    )
    expect(gap.map(p => p.total)).toEqual([1, 0, 0])
    expect(gap[1].rate).toBe(0)
  })
})

describe('computeActivityTrend', () => {
  it('maps per-week active teacher counts to a rate over totalTeachers', () => {
    const rows = [{ week_start: '2026-05-04', active: 2 }]
    const pts = computeActivityTrend(rows, 4, '2026-05-04', new Date('2026-05-04T12:00:00'))
    expect(pts[0]).toMatchObject({ active: 2, total: 4, rate: 0.5 })
  })
  it('rate is 0 when there are no teachers', () => {
    const pts = computeActivityTrend([], 0, '2026-05-04', new Date('2026-05-04T12:00:00'))
    expect(pts[0].rate).toBe(0)
  })
  it('keeps each week independent and fills gaps with 0', () => {
    const rows = [{ week_start: '2026-05-04', active: 1 }, { week_start: '2026-05-11', active: 1 }]
    const pts = computeActivityTrend(rows, 2, '2026-05-04', new Date('2026-05-11T12:00:00'))
    expect(pts).toHaveLength(2)
    expect(pts[0]).toMatchObject({ active: 1, total: 2, rate: 0.5 })
    expect(pts[1]).toMatchObject({ active: 1, total: 2, rate: 0.5 })
  })
})

describe('computeClassAbsence', () => {
  it('computes per-class absent rate sorted worst-first', () => {
    const rows = [
      { class_id: 'c1', total: 2, absent: 1 },
      { class_id: 'c2', total: 2, absent: 2 },
    ]
    const classes = [
      { id: 'c1', name: '9-A', grade: 9 }, { id: 'c2', name: '10-B', grade: 10 },
    ]
    const out = computeClassAbsence(rows, classes)
    expect(out[0]).toMatchObject({ classId: 'c2', rate: 1 })
    expect(out[1]).toMatchObject({ classId: 'c1', rate: 0.5 })
  })
  it('omits classes with no attendance rows', () => {
    const out = computeClassAbsence([], [{ id: 'c1', name: '9-A', grade: 9 }])
    expect(out).toEqual([])
  })
})

describe('computeCoverageTrend', () => {
  // 3 sınıf; beklenen = sınıf × hafta içi gün (Pzt–Cum)
  const classCount = 3
  it('tam haftada beklenen = sınıf × 5, alınan = RPC recorded', () => {
    const rows = [{ week_start: '2026-05-04', recorded: 3 }]
    const [pt] = computeCoverageTrend(rows, classCount, '2026-05-04', new Date('2026-05-10T12:00:00'))
    expect(pt.recorded).toBe(3)
    expect(pt.expected).toBe(15)       // 3 sınıf × 5 gün
    expect(pt.rate).toBeCloseTo(3 / 15)
  })
  it('güncel kısmi haftada beklenen, bugüne kadarki hafta içi günlerle sınırlı', () => {
    // hafta başı Pzt 2026-05-04, "bugün" Salı 2026-05-05 → 2 hafta içi günü
    const [pt] = computeCoverageTrend(
      [{ week_start: '2026-05-04', recorded: 1 }],
      classCount, '2026-05-04', new Date('2026-05-05T12:00:00'),
    )
    expect(pt.expected).toBe(6)        // 3 sınıf × 2 gün
    expect(pt.recorded).toBe(1)
  })
  it('hiç sınıf yoksa rate 0 (sıfıra bölme yok)', () => {
    const [pt] = computeCoverageTrend([], 0, '2026-05-04', new Date('2026-05-08T12:00:00'))
    expect(pt.rate).toBe(0)
  })
})

describe('filledWeekCount', () => {
  it('counts weeks with at least one record', () => {
    expect(filledWeekCount([{ total: 3 }, { total: 0 }, { total: 1 }])).toBe(2)
  })
})
