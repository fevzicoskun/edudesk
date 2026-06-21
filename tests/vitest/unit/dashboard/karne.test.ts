import { describe, it, expect } from 'vitest'
import { buildKarneData } from '@/src/domains/dashboard/lib/karne'
import type {
  AbsenceTrendPoint, ActivityTrendPoint, CoverageTrendPoint, ClassAbsence,
} from '@/src/domains/dashboard/lib/trendMath'

const WS = ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25']
const NOW = new Date('2026-06-01T12:00:00')

const abs = (r: number[]): AbsenceTrendPoint[] =>
  WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: r[i], absent: 1, total: 10 }))
const act = (r: number[]): ActivityTrendPoint[] =>
  WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: r[i], active: 1, total: 4 }))
const cov = (r: number[]): CoverageTrendPoint[] =>
  WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: r[i], recorded: 9, expected: 10 }))
const cls = (classId: string, name: string, rate: number): ClassAbsence =>
  ({ classId, name, grade: 9, rate, absent: Math.round(rate * 100), total: 100 })

describe('buildKarneData', () => {
  it('metrikleri son hafta + dönem ortalaması olarak %-çevirir', () => {
    const k = buildKarneData(
      'Test Okulu', '2026-02-01',
      abs([0.10, 0.10, 0.10, 0.20]), act([1, 1, 1, 1]), cov([0.9, 0.9, 0.9, 0.9]), [], NOW,
    )
    expect(k.metrics.devamsizlik.sonHafta).toBe(20)
    expect(k.metrics.devamsizlik.donemOrt).toBe(13)
    expect(k.metrics.kapsama).toEqual({ sonHafta: 90, donemOrt: 90 })
    expect(k.metrics.aktivite).toEqual({ sonHafta: 100, donemOrt: 100 })
    expect(k.schoolName).toBe('Test Okulu')
    expect(k.donemStart).toBe('2026-02-01')
    expect(typeof k.generatedAt).toBe('string')
  })
  it('classAbsence %-çevrili ve gelen sırada', () => {
    const k = buildKarneData('Okul', '2026-02-01', abs([0.05,0.05,0.05,0.05]), act([1,1,1,1]), cov([0.9,0.9,0.9,0.9]),
      [cls('c1', '9-C', 0.30), cls('c2', '9-A', 0.05)], NOW)
    expect(k.classAbsence[0]).toEqual({ name: '9-C', grade: 9, rate: 30 })
    expect(k.classAbsence[1]).toEqual({ name: '9-A', grade: 9, rate: 5 })
  })
  it('sınıf bozulması varsa warnings dolu', () => {
    const k = buildKarneData('Okul', '2026-02-01', abs([0.05,0.05,0.05,0.05]), act([1,1,1,1]), cov([0.9,0.9,0.9,0.9]),
      [cls('c1', '9-C', 0.30), cls('c2', '9-A', 0.05)], NOW)
    expect(k.warnings.some(w => w.metric === 'sinif' && w.classId === 'c1')).toBe(true)
  })
  it('boş/yetersiz veri → metrikler 0, diziler boş, çökme yok', () => {
    const k = buildKarneData('Okul', '2026-02-01', [], [], [], [], NOW)
    expect(k.metrics.devamsizlik).toEqual({ sonHafta: 0, donemOrt: 0 })
    expect(k.classAbsence).toEqual([])
    expect(k.warnings).toEqual([])
  })
})
