// tests/vitest/unit/domains/dashboard/trendMath.test.ts
import { describe, it, expect } from 'vitest'
import {
  weekKeysBetween, computeAbsenceTrend, computeActivityTrend,
  computeClassAbsence, filledWeekCount,
} from '@/src/domains/dashboard/lib/trendMath'

describe('weekKeysBetween', () => {
  it('returns Monday-anchored weeks inclusive of start and end', () => {
    // 2026-05-05 is a Tuesday -> week of Mon 2026-05-04
    const keys = weekKeysBetween('2026-05-05', new Date('2026-05-20T12:00:00'))
    expect(keys).toEqual(['2026-05-04', '2026-05-11', '2026-05-18'])
  })
})

describe('computeAbsenceTrend', () => {
  const rows = [
    { date: '2026-05-04', status: 'absent' },
    { date: '2026-05-05', status: 'present' },
    { date: '2026-05-06', status: 'late' },     // pay'a girmez
    { date: '2026-05-07', status: 'excused' },  // pay'a girmez
    { date: '2026-05-11', status: 'absent' },
    { date: '2026-05-12', status: 'absent' },
  ]
  const points = computeAbsenceTrend(rows, '2026-05-04', new Date('2026-05-12T12:00:00'))

  it('produces one point per calendar week', () => {
    expect(points.map(p => p.weekStart)).toEqual(['2026-05-04', '2026-05-11'])
  })
  it('counts only absent in numerator, all rows in denominator', () => {
    // hafta1: 1 absent / 4 toplam = 0.25 ; hafta2: 2 absent / 2 = 1.0
    expect(points[0]).toMatchObject({ absent: 1, total: 4, rate: 0.25 })
    expect(points[1]).toMatchObject({ absent: 2, total: 2, rate: 1 })
  })
  it('emits rate 0 for a week with no attendance rows (gap week)', () => {
    const gap = computeAbsenceTrend(
      [{ date: '2026-05-04', status: 'absent' }],
      '2026-05-04', new Date('2026-05-18T12:00:00'),
    )
    expect(gap.map(p => p.total)).toEqual([1, 0, 0])
    expect(gap[1].rate).toBe(0)
  })
})

describe('computeActivityTrend', () => {
  it('counts a teacher once per week across attendance and homework', () => {
    const att = [
      { date: '2026-05-04', teacher_id: 't1' },
      { date: '2026-05-05', teacher_id: 't1' }, // aynı öğretmen, bir kez sayılır
    ]
    const hw = [{ assigned_date: '2026-05-06', teacher_id: 't2' }]
    const pts = computeActivityTrend(att, hw, 4, '2026-05-04', new Date('2026-05-04T12:00:00'))
    // hafta1: t1+t2 aktif = 2 / 4 = 0.5
    expect(pts[0]).toMatchObject({ active: 2, total: 4, rate: 0.5 })
  })
  it('rate is 0 when there are no teachers', () => {
    const pts = computeActivityTrend([], [], 0, '2026-05-04', new Date('2026-05-04T12:00:00'))
    expect(pts[0].rate).toBe(0)
  })
})

describe('computeClassAbsence', () => {
  it('computes per-class absent rate sorted worst-first', () => {
    const rows = [
      { class_id: 'c1', status: 'absent' }, { class_id: 'c1', status: 'present' },
      { class_id: 'c2', status: 'absent' }, { class_id: 'c2', status: 'absent' },
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

describe('filledWeekCount', () => {
  it('counts weeks with at least one record', () => {
    expect(filledWeekCount([{ total: 3 }, { total: 0 }, { total: 1 }])).toBe(2)
  })
})
