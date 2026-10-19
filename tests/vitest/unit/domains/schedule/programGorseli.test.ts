import { describe, it, expect } from 'vitest'
import { gorunenSaatler, sinifPuntosu } from '@/src/domains/schedule/programGorseli'
import { DEFAULT_PERIODS } from '@/src/domains/schedule/scheduleMath'

describe('gorunenSaatler', () => {
  it('son dolu saatten sonraki boş saatler kırpılır, aradaki boşlar kalır', () => {
    const s = gorunenSaatler(DEFAULT_PERIODS, [{ day: 1, period: 2, class_id: 'a' }, { day: 3, period: 6, class_id: 'b' }])
    expect(s.map(p => p.no)).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('sinifPuntosu', () => {
  it('kısa ad tam punto, uzun ad küçülür', () => {
    expect(sinifPuntosu('11-B')).toBe(40)
    expect(sinifPuntosu('__PW_TEST__9-A')).toBeLessThan(20)
  })
})
