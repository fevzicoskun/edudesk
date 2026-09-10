import { describe, it, expect } from 'vitest'
import { addDaysISO, istanbulLocalToUtc } from '@/src/shared/date'

describe('addDaysISO', () => {
  it('gün ekler/çıkarır, ay ve yıl sınırını geçer', () => {
    expect(addDaysISO('2026-09-10', 1)).toBe('2026-09-11')
    expect(addDaysISO('2026-01-31', 30)).toBe('2026-03-02')
    expect(addDaysISO('2026-09-10', -30)).toBe('2026-08-11')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('saat dilimi/DST etkisiyle günü kaydırmaz (UTC aritmetiği)', () => {
    expect(addDaysISO('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDaysISO('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('istanbulLocalToUtc', () => {
  it('İstanbul yerel saatini UTC anına çevirir (UTC+3)', () => {
    expect(istanbulLocalToUtc('2026-09-14', '08:00').toISOString()).toBe('2026-09-14T05:00:00.000Z')
    expect(istanbulLocalToUtc('2026-01-05', '17:45').toISOString()).toBe('2026-01-05T14:45:00.000Z')
  })

  it('gece yarısına yakın yerel saat UTC önceki güne düşer (yerel gün değişmez)', () => {
    expect(istanbulLocalToUtc('2026-09-14', '01:30').toISOString()).toBe('2026-09-13T22:30:00.000Z')
  })
})
