import { describe, it, expect } from 'vitest'
import { firstRunState } from '@/src/domains/dashboard/lib/firstRun'

describe('firstRunState', () => {
  it('sınıf varsa hiçbir rol için ilk-kullanım göstermez', () => {
    for (const r of ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur', 'admin'] as const) {
      expect(firstRunState(r, 1)).toBeNull()
    }
  })

  it('müdür/MY + 0 sınıf → setup', () => {
    expect(firstRunState('mudur', 0)).toBe('setup')
    expect(firstRunState('mudur_yardimcisi', 0)).toBe('setup')
  })

  it('öğretmen/zümre başkanı/admin + 0 sınıf → waiting', () => {
    expect(firstRunState('ogretmen', 0)).toBe('waiting')
    expect(firstRunState('zumre_baskani', 0)).toBe('waiting')
    expect(firstRunState('admin', 0)).toBe('waiting')
  })
})
