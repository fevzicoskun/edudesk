import { describe, it, expect } from 'vitest'
import { selectTrendWindow } from '@/src/domains/dashboard/lib/earlyWarning'

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
