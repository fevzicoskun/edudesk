import { describe, it, expect } from 'vitest'
import { selectTrendWindow, computeEarlyWarnings } from '@/src/domains/dashboard/lib/earlyWarning'
import type { AbsenceTrendPoint, ActivityTrendPoint, CoverageTrendPoint } from '@/src/domains/dashboard/lib/trendMath'

const real = new Set(['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'])
const NOW = new Date('2026-06-01T12:00:00') // hafta başı 2026-06-01 → 05-25 tam hafta

const pts = (vals: [string, number][]) => vals.map(([weekStart, rate]) => ({ weekStart, rate }))

describe('selectTrendWindow', () => {
  it('son tam haftayı ve baz ortalamasını döndürür', () => {
    const w = selectTrendWindow(
      pts([['2026-05-04', 0.1], ['2026-05-11', 0.1], ['2026-05-18', 0.1], ['2026-05-25', 0.2]]),
      real, NOW,
    )
    expect(w).not.toBeNull()
    expect(w!.last).toBe(0.2)
    expect(w!.baselineMean).toBeCloseTo(0.1)
    expect(w!.baselineCount).toBe(3)
  })

  it('içinde bulunulan (yarım) haftayı son/baz olarak kullanmaz', () => {
    const withCurrent = pts([
      ['2026-05-04', 0.1], ['2026-05-11', 0.1], ['2026-05-18', 0.1],
      ['2026-05-25', 0.2], ['2026-06-01', 0.9],
    ])
    const realPlus = new Set([...real, '2026-06-01'])
    const w = selectTrendWindow(withCurrent, realPlus, NOW)
    expect(w!.last).toBe(0.2)
  })

  it('tatil (real olmayan) haftaları eler', () => {
    const w = selectTrendWindow(
      pts([['2026-05-04', 0.1], ['2026-05-11', 0.0], ['2026-05-18', 0.1], ['2026-05-25', 0.2]]),
      new Set(['2026-05-04', '2026-05-18', '2026-05-25']),
      NOW,
    )
    expect(w!.baselineCount).toBe(2)
  })

  it('<2 baz hafta → null (veri birikiyor)', () => {
    const w = selectTrendWindow(
      pts([['2026-05-18', 0.1], ['2026-05-25', 0.2]]),
      new Set(['2026-05-18', '2026-05-25']),
      NOW,
    )
    expect(w).toBeNull()
  })
})

const WS = ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25']
const NOW2 = new Date('2026-06-01T12:00:00')

function abs(rates: number[]): AbsenceTrendPoint[] {
  return WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: rates[i], absent: 1, total: 10 }))
}
function act(rates: number[]): ActivityTrendPoint[] {
  return WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: rates[i], active: 1, total: 4 }))
}
function cov(rates: number[]): CoverageTrendPoint[] {
  return WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: rates[i], recorded: 1, expected: 10 }))
}

const flatAct = act([1, 1, 1, 1])
const flatCov = cov([0.9, 0.9, 0.9, 0.9])
const flatAbs = abs([0.05, 0.05, 0.05, 0.05])

describe('computeEarlyWarnings — zaman sapması', () => {
  it('devamsızlık baz+3 puanı aşınca uyarır', () => {
    const ws = computeEarlyWarnings(abs([0.05, 0.05, 0.05, 0.09]), flatAct, flatCov, [], NOW2)
    const a = ws.find(w => w.metric === 'devamsizlik')
    expect(a).toBeDefined()
    expect(a!.severity).toBe('dikkat')
  })
  it('devamsızlık küçük artışta (+1 puan) uyarmaz', () => {
    const ws = computeEarlyWarnings(abs([0.05, 0.05, 0.05, 0.06]), flatAct, flatCov, [], NOW2)
    expect(ws.find(w => w.metric === 'devamsizlik')).toBeUndefined()
  })
  it('devamsızlık baz+6 puan (2× eşik) → yuksek', () => {
    const ws = computeEarlyWarnings(abs([0.05, 0.05, 0.05, 0.12]), flatAct, flatCov, [], NOW2)
    expect(ws.find(w => w.metric === 'devamsizlik')!.severity).toBe('yuksek')
  })
  it('kapsama baz−10 puan düşünce uyarır', () => {
    const ws = computeEarlyWarnings(flatAbs, flatAct, cov([0.9, 0.9, 0.9, 0.78]), [], NOW2)
    expect(ws.find(w => w.metric === 'kapsama')).toBeDefined()
  })
  it('aktivite baz−15 puan düşünce uyarır', () => {
    const ws = computeEarlyWarnings(flatAbs, act([1, 1, 1, 0.8]), flatCov, [], NOW2)
    expect(ws.find(w => w.metric === 'aktivite')).toBeDefined()
  })
  it('her şey stabilse boş döner', () => {
    expect(computeEarlyWarnings(flatAbs, flatAct, flatCov, [], NOW2)).toEqual([])
  })
})
