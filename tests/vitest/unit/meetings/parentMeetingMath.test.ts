import { describe, it, expect } from 'vitest'
import { weekdayFromDate, freePeriods } from '@/src/domains/meetings/parentMeetingMath'
import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'

const periods: Period[] = [
  { no: 1, start: '09:00', end: '09:35' },
  { no: 2, start: '09:45', end: '10:20' },
  { no: 3, start: '10:25', end: '11:00' },
]

describe('weekdayFromDate()', () => {
  it('2026-06-22 (Pazartesi) → 1', () => expect(weekdayFromDate('2026-06-22')).toBe(1))
  it('2026-06-26 (Cuma) → 5', () => expect(weekdayFromDate('2026-06-26')).toBe(5))
  it('2026-06-27 (Cumartesi) → 6', () => expect(weekdayFromDate('2026-06-27')).toBe(6))
  it('2026-06-28 (Pazar) → 7', () => expect(weekdayFromDate('2026-06-28')).toBe(7))
})

describe('freePeriods()', () => {
  const slots: Slot[] = [
    { day: 1, period: 1, class_id: 'c1' }, // Pzt 1. ders dolu
    { day: 1, period: 3, class_id: 'c2' }, // Pzt 3. ders dolu
    { day: 2, period: 1, class_id: 'c1' }, // Salı 1. ders dolu
  ]

  it('Pazartesi → sadece 2. ders boş', () => {
    const free = freePeriods(slots, periods, 1, [])
    expect(free.map(p => p.no)).toEqual([2])
  })

  it('boş periyot zaten rezerve → çıkar', () => {
    const free = freePeriods(slots, periods, 1, [2])
    expect(free).toHaveLength(0)
  })

  it('hafta sonu (weekday 6) → boş dizi', () => {
    expect(freePeriods(slots, periods, 6, [])).toHaveLength(0)
  })

  it('hiç ders olmayan gün → tüm periyotlar boş', () => {
    const free = freePeriods(slots, periods, 5, [])
    expect(free.map(p => p.no)).toEqual([1, 2, 3])
  })

  it('tam dolu gün → boş dizi', () => {
    const fullSlots: Slot[] = periods.map(p => ({ day: 3, period: p.no, class_id: 'c1' }))
    expect(freePeriods(fullSlots, periods, 3, [])).toHaveLength(0)
  })
})
