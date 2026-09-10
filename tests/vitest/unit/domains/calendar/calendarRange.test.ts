import { describe, it, expect } from 'vitest'
import { parseTimeRange, expandDutiesRange, type DutyInput } from '@/src/domains/calendar/calendarMath'

describe('parseTimeRange', () => {
  it.each([
    ['08:00–08:40', { start: '08:00', end: '08:40' }],
    ['08:00-08:40', { start: '08:00', end: '08:40' }],
    ['8.00 - 8.40', { start: '08:00', end: '08:40' }],
    [' 12:30 — 13:10 ', { start: '12:30', end: '13:10' }],
  ])('"%s" → saat aralığı', (raw, expected) => {
    expect(parseTimeRange(raw)).toEqual(expected)
  })

  it.each(['Öğle arası', '', '08:00', '25:00-26:00', '08:61-09:00', '09:00-08:00', '08:00-08:00'])(
    'geçersiz/serbest metin "%s" → null',
    raw => {
      expect(parseTimeRange(raw)).toBeNull()
    },
  )
})

describe('expandDutiesRange', () => {
  // 2026-09-28 ve 2026-10-05 Pazartesi
  const duties: DutyInput[] = [
    { id: 'd1', day_of_week: 1, time_range: '08:00–08:40', location: 'Bahçe' },
  ]

  it('ay sınırını aşan aralıkta yalnız aralık içindeki günleri üretir', () => {
    const events = expandDutiesRange(duties, '2026-09-28', '2026-10-06', new Set())
    expect(events.map(e => e.date)).toEqual(['2026-09-28', '2026-10-05'])
    expect(events[0]).toMatchObject({ type: 'nobet', id: 'd1', start: '08:00', end: '08:40', detail: '08:00–08:40' })
  })

  it('tatile denk gelen nöbeti atlar', () => {
    const events = expandDutiesRange(duties, '2026-09-28', '2026-10-06', new Set(['2026-10-05']))
    expect(events.map(e => e.date)).toEqual(['2026-09-28'])
  })

  it('tek ay aralığında expandDuties ile aynı sonucu verir', () => {
    const events = expandDutiesRange(duties, '2026-09-01', '2026-09-30', new Set())
    expect(events.map(e => e.date)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
  })

  it('serbest metin saat aralığında start/end üretmez (tüm gün olur)', () => {
    const events = expandDutiesRange(
      [{ day_of_week: 1, time_range: 'Öğle arası', location: 'Kantin' }],
      '2026-09-28', '2026-09-28', new Set(),
    )
    expect(events).toHaveLength(1)
    expect(events[0].start).toBeUndefined()
    expect(events[0].end).toBeUndefined()
  })
})
