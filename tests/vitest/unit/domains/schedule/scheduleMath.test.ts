import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PERIODS,
  validatePeriods,
  validateSlots,
  todaysLessons,
  formatOzetBody,
  type Period,
  type Slot,
} from '@/src/domains/schedule/scheduleMath'

const P: Period[] = [
  { no: 1, start: '08:30', end: '09:05' },
  { no: 2, start: '09:15', end: '09:50' },
  { no: 3, start: '09:55', end: '10:30' },
]

describe('DEFAULT_PERIODS', () => {
  it('geçerli ve artan sıralı', () => {
    expect(validatePeriods(DEFAULT_PERIODS)).toBeNull()
    expect(DEFAULT_PERIODS.length).toBe(8)
  })
})

describe('validatePeriods', () => {
  it('boş listeyi reddeder', () => {
    expect(validatePeriods([])).not.toBeNull()
  })
  it('start >= end ise reddeder', () => {
    expect(validatePeriods([{ no: 1, start: '10:00', end: '09:00' }])).not.toBeNull()
  })
  it('çakışan/sıra dışı periyodu reddeder', () => {
    const bad: Period[] = [
      { no: 1, start: '08:30', end: '09:05' },
      { no: 2, start: '09:00', end: '09:40' }, // önceki bitişten önce başlıyor
    ]
    expect(validatePeriods(bad)).not.toBeNull()
  })
  it('yinelenen no reddeder', () => {
    const bad: Period[] = [
      { no: 1, start: '08:30', end: '09:05' },
      { no: 1, start: '09:15', end: '09:50' },
    ]
    expect(validatePeriods(bad)).not.toBeNull()
  })
  it('aralık dışı saati reddeder', () => {
    expect(validatePeriods([{ no: 1, start: '25:00', end: '25:30' }])).not.toBeNull()
  })
})

describe('validateSlots', () => {
  const ids = ['c1', 'c2']
  it('geçerli slotları kabul eder', () => {
    const slots: Slot[] = [{ day: 1, period: 1, class_id: 'c1' }]
    expect(validateSlots(slots, P, ids)).toBeNull()
  })
  it('gün aralığı dışını reddeder', () => {
    expect(validateSlots([{ day: 6, period: 1, class_id: 'c1' }], P, ids)).not.toBeNull()
  })
  it('var olmayan periyodu reddeder', () => {
    expect(validateSlots([{ day: 1, period: 9, class_id: 'c1' }], P, ids)).not.toBeNull()
  })
  it('okulda olmayan sınıfı reddeder (cross-tenant)', () => {
    expect(validateSlots([{ day: 1, period: 1, class_id: 'yabanci' }], P, ids)).not.toBeNull()
  })
  it('aynı (gün,periyot) iki slotu reddeder', () => {
    const dup: Slot[] = [
      { day: 1, period: 1, class_id: 'c1' },
      { day: 1, period: 1, class_id: 'c2' },
    ]
    expect(validateSlots(dup, P, ids)).not.toBeNull()
  })
  it('boş slot dizisini kabul eder', () => {
    expect(validateSlots([], P, ids)).toBeNull()
  })
})

describe('todaysLessons', () => {
  const slots: Slot[] = [
    { day: 1, period: 3, class_id: 'c2' },
    { day: 1, period: 1, class_id: 'c1' },
    { day: 2, period: 1, class_id: 'c1' },
  ]
  it('günü filtreler ve saate göre sıralar', () => {
    const r = todaysLessons(slots, P, 1)
    expect(r.map(x => x.period)).toEqual([1, 3])
    expect(r[0]).toEqual({ period: 1, start: '08:30', end: '09:05', classId: 'c1' })
  })
  it('dersi olmayan gün için boş döner', () => {
    expect(todaysLessons(slots, P, 5)).toEqual([])
  })
})

describe('formatOzetBody', () => {
  it('periyot ve sınıfı okunur biçimde birleştirir', () => {
    const body = formatOzetBody([
      { period: 1, className: '9-A' },
      { period: 3, className: '10-B' },
    ])
    expect(body).toBe('1. ders 9-A · 3. ders 10-B')
  })
  it('ters sıralı girişi sıralar', () => {
    expect(formatOzetBody([{ period: 3, className: '10-B' }, { period: 1, className: '9-A' }])).toBe('1. ders 9-A · 3. ders 10-B')
  })
})
