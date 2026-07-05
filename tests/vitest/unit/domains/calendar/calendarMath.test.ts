import { describe, it, expect } from 'vitest'
import {
  parseAyParam, toDateStr, buildMonthCells, expandDuties, groupByDay,
  type CalendarEvent,
} from '@/src/domains/calendar/calendarMath'

describe('parseAyParam', () => {
  const today = new Date(2026, 6, 5) // 5 Temmuz 2026

  it('geçerli ay parametresini çözer', () => {
    expect(parseAyParam('2026-03', today)).toEqual({ year: 2026, month: 3 })
  })

  it.each(['abc', '2026-13', '2026-00', '2026', '', '2026-3'])('geçersiz "%s" → içinde bulunulan ay', raw => {
    expect(parseAyParam(raw, today)).toEqual({ year: 2026, month: 7 })
  })

  it('undefined → içinde bulunulan ay', () => {
    expect(parseAyParam(undefined, today)).toEqual({ year: 2026, month: 7 })
  })
})

describe('toDateStr', () => {
  it('tek haneli ay/günü sıfırla doldurur', () => {
    expect(toDateStr(2026, 7, 5)).toBe('2026-07-05')
    expect(toDateStr(2026, 12, 31)).toBe('2026-12-31')
  })
})

describe('buildMonthCells', () => {
  it('Temmuz 2026: 1 Temmuz Çarşamba → önde 2 dolgu hücre, toplam 7 katı', () => {
    const cells = buildMonthCells(2026, 7)
    expect(cells.length % 7).toBe(0)
    expect(cells[0].inMonth).toBe(false)          // 29 Haziran (Pzt)
    expect(cells[2]).toEqual({ date: '2026-07-01', day: 1, inMonth: true })
    expect(cells.filter(c => c.inMonth)).toHaveLength(31)
  })

  it('Haziran 2026: 1 Haziran Pazartesi → önde dolgu yok', () => {
    const cells = buildMonthCells(2026, 6)
    expect(cells[0]).toEqual({ date: '2026-06-01', day: 1, inMonth: true })
  })

  it('Şubat 2027 (28 gün, 1 Şubat Pazartesi) → tam 28 hücre', () => {
    const cells = buildMonthCells(2027, 2)
    expect(cells).toHaveLength(28)
    expect(cells.every(c => c.inMonth)).toBe(true)
  })
})

describe('expandDuties', () => {
  const nobet = { day_of_week: 3, time_range: '08:00-16:00', location: 'A Blok' } // Çarşamba

  it('haftalık nöbeti ayın somut tarihlerine genişletir', () => {
    const events = expandDuties([nobet], 2026, 7, new Set())
    // Temmuz 2026 Çarşambaları: 1, 8, 15, 22, 29
    expect(events.map(e => e.date)).toEqual(['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29'])
    expect(events[0].type).toBe('nobet')
    expect(events[0].title).toBe('Nöbet — A Blok')
    expect(events[0].detail).toBe('08:00-16:00')
  })

  it('tatile denk gelen nöbet günü atlanır', () => {
    const events = expandDuties([nobet], 2026, 7, new Set(['2026-07-15']))
    expect(events.map(e => e.date)).toEqual(['2026-07-01', '2026-07-08', '2026-07-22', '2026-07-29'])
  })

  it('teacherName verilirse başlığa eklenir (müdür görünümü)', () => {
    const events = expandDuties([{ ...nobet, teacherName: 'Ali Veli' }], 2026, 7, new Set())
    expect(events[0].title).toBe('Nöbet — A Blok (Ali Veli)')
  })

  it('1-5 aralığı dışındaki day_of_week üretim yapmaz', () => {
    expect(expandDuties([{ ...nobet, day_of_week: 6 }], 2026, 7, new Set())).toEqual([])
    expect(expandDuties([{ ...nobet, day_of_week: 0 }], 2026, 7, new Set())).toEqual([])
  })
})

describe('groupByDay', () => {
  it('güne gruplar ve gün içinde tatil→etkinlik→nobet→randevu→odev sıralar', () => {
    const events: CalendarEvent[] = [
      { date: '2026-07-10', type: 'odev', title: 'Ödev teslimi — Kesirler' },
      { date: '2026-07-10', type: 'tatil', title: 'Tatil' },
      { date: '2026-07-10', type: 'randevu', title: 'Veli görüşmesi' },
      { date: '2026-07-11', type: 'etkinlik', title: 'Gezi' },
      { date: '2026-07-10', type: 'nobet', title: 'Nöbet — A Blok' },
    ]
    const grouped = groupByDay(events)
    expect(Object.keys(grouped).sort()).toEqual(['2026-07-10', '2026-07-11'])
    expect(grouped['2026-07-10'].map(e => e.type)).toEqual(['tatil', 'nobet', 'randevu', 'odev'])
  })

  it('boş liste → boş nesne', () => {
    expect(groupByDay([])).toEqual({})
  })
})
