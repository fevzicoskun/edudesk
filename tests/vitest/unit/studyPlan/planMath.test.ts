import { describe, it, expect } from 'vitest'
import {
  weekStartOf, shiftWeek, weekDays, isInWeek, dayLabel, formatWeekLabel,
  copyWeek, weekSummary, groupBySubject,
} from '@/src/domains/studyPlan/planMath'

describe('weekStartOf()', () => {
  it('Pazartesi kendisi', () => expect(weekStartOf('2026-09-07')).toBe('2026-09-07'))
  it('Çarşamba → Pazartesi', () => expect(weekStartOf('2026-09-09')).toBe('2026-09-07'))
  it('Pazar → önceki Pazartesi (JS getDay=0 tuzağı)', () => expect(weekStartOf('2026-09-13')).toBe('2026-09-07'))
  it('yıl geçişi: 2027-01-01 (Cuma) → 2026-12-28', () => expect(weekStartOf('2027-01-01')).toBe('2026-12-28'))
})

describe('shiftWeek() / weekDays() / isInWeek()', () => {
  it('+1 hafta', () => expect(shiftWeek('2026-09-07', 1)).toBe('2026-09-14'))
  it('-1 hafta yıl geçişi', () => expect(shiftWeek('2027-01-04', -1)).toBe('2026-12-28'))
  it('weekDays 7 gün Pzt..Paz', () => {
    const d = weekDays('2026-09-07')
    expect(d).toHaveLength(7)
    expect(d[0]).toBe('2026-09-07'); expect(d[6]).toBe('2026-09-13')
  })
  it('isInWeek sınırlar dahil, dışı hariç', () => {
    expect(isInWeek('2026-09-07', '2026-09-07')).toBe(true)
    expect(isInWeek('2026-09-13', '2026-09-07')).toBe(true)
    expect(isInWeek('2026-09-14', '2026-09-07')).toBe(false)
    expect(isInWeek('2026-09-06', '2026-09-07')).toBe(false)
  })
})

describe('dayLabel() / formatWeekLabel()', () => {
  it('null → Hafta', () => expect(dayLabel(null)).toBe('Hafta'))
  it('Pazar → Paz', () => expect(dayLabel('2026-09-13')).toBe('Paz'))
  it('aynı ay', () => expect(formatWeekLabel('2026-09-07')).toBe('7 – 13 Eylül 2026'))
  it('ay geçişi', () => expect(formatWeekLabel('2026-09-28')).toBe('28 Eylül – 4 Ekim 2026'))
  it('yıl geçişi', () => expect(formatWeekLabel('2026-12-28')).toBe('28 Aralık 2026 – 3 Ocak 2027'))
})

describe('copyWeek()', () => {
  const items = [
    { plan_date: '2026-09-09', source: 'Apotemi', description: 'Türev 40 soru', subject: 'Matematik', status: 'yapildi' as const, note: 'iyi' },
    { plan_date: null,         source: null,      description: 'Deneme çöz',    subject: 'Matematik', status: 'eksik'   as const, note: null },
  ]
  it('aynı haftagününe kaydırır, durum/notu sıfırlar', () => {
    const out = copyWeek(items, '2026-09-07', '2026-09-14')
    expect(out).toEqual([
      { plan_date: '2026-09-16', source: 'Apotemi', description: 'Türev 40 soru', subject: 'Matematik', status: 'planlandi', note: null },
      { plan_date: null,         source: null,      description: 'Deneme çöz',    subject: 'Matematik', status: 'planlandi', note: null },
    ])
  })
  it('boş liste → boş', () => expect(copyWeek([], '2026-09-07', '2026-09-14')).toEqual([]))
})

describe('weekSummary()', () => {
  it('0 madde → yüzde 0', () => expect(weekSummary([])).toEqual({ toplam: 0, yapildi: 0, eksik: 0, yapilmadi: 0, yuzde: 0 }))
  it('sayar ve yüzdeyi yuvarlar', () => {
    const s = weekSummary([{ status: 'yapildi' }, { status: 'yapildi' }, { status: 'eksik' }, { status: 'planlandi' }])
    expect(s).toEqual({ toplam: 4, yapildi: 2, eksik: 1, yapilmadi: 0, yuzde: 50 })
  })
})

describe('groupBySubject()', () => {
  it('ilk görülme sırasıyla gruplar', () => {
    const g = groupBySubject([{ subject: 'Fizik', id: 1 }, { subject: 'Matematik', id: 2 }, { subject: 'Fizik', id: 3 }])
    expect(g.map(x => x.subject)).toEqual(['Fizik', 'Matematik'])
    expect(g[0].items.map(i => i.id)).toEqual([1, 3])
  })
})
