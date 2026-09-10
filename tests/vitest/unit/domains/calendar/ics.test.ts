import { describe, it, expect } from 'vitest'
import { escapeIcsText, foldIcsLine, buildIcsCalendar } from '@/src/domains/calendar/ics'
import type { CalendarEvent } from '@/src/domains/calendar/calendarMath'

const byteLen = (s: string) => new TextEncoder().encode(s).length
const unfold = (s: string) => s.replace(/\r\n /g, '')
const NOW = new Date('2026-09-10T09:15:30.000Z')

describe('escapeIcsText', () => {
  it('ters eğik çizgi, virgül, noktalı virgül ve satır sonlarını kaçışlar', () => {
    expect(escapeIcsText('a\\b')).toBe('a\\\\b')
    expect(escapeIcsText('Ali, Veli; not')).toBe('Ali\\, Veli\\; not')
    expect(escapeIcsText('satır1\nsatır2\r\nsatır3\rsatır4')).toBe('satır1\\nsatır2\\nsatır3\\nsatır4')
  })
})

describe('foldIcsLine', () => {
  it('75 oktetten kısa satırı olduğu gibi bırakır', () => {
    expect(foldIcsLine('SUMMARY:kısa')).toBe('SUMMARY:kısa')
  })

  it('her fiziksel satır ≤75 oktet; açınca özgün satır geri gelir', () => {
    const line = 'DESCRIPTION:' + 'Öğretmenler odası nöbeti — şube çalışması; '.repeat(8)
    const folded = foldIcsLine(line)
    for (const physical of folded.split('\r\n')) expect(byteLen(physical)).toBeLessThanOrEqual(75)
    expect(folded.split('\r\n').slice(1).every(l => l.startsWith(' '))).toBe(true)
    expect(unfold(folded)).toBe(line)
  })

  it('çok baytlı Türkçe karakteri bölmez (sınırda katlar)', () => {
    // 8 + 66 = 74 oktet; "Ş" 2 oktet → 76 olacağı için Ş'den önce katlanmalı
    const line = 'SUMMARY:' + 'a'.repeat(66) + 'Şa'
    const [first, second] = foldIcsLine(line).split('\r\n')
    expect(byteLen(first)).toBe(74)
    expect(second).toBe(' Şa')
  })

  it('surrogate çiftini (emoji) bölmez', () => {
    const line = 'SUMMARY:' + 'a'.repeat(65) + '📚📚📚'
    const folded = foldIcsLine(line)
    expect(folded).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
    expect(unfold(folded)).toBe(line)
    for (const physical of folded.split('\r\n')) expect(byteLen(physical)).toBeLessThanOrEqual(75)
  })
})

describe('buildIcsCalendar', () => {
  const events: CalendarEvent[] = [
    { date: '2026-09-14', type: 'nobet', title: 'Nöbet — Bahçe', detail: '08:00–08:40', id: 'd1', start: '08:00', end: '08:40' },
    { date: '2026-09-30', type: 'etkinlik', title: 'Gezi, Müze; Ankara', detail: 'Satır1\nSatır2', id: 'e1' },
    { date: '2026-10-29', type: 'tatil', title: 'Cumhuriyet Bayramı' },
  ]

  it('VCALENDAR iskeleti, CRLF satır sonları ve takvim adı', () => {
    const ics = buildIcsCalendar(events, NOW)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('\r\nVERSION:2.0\r\n')
    expect(ics).toMatch(/\r\nPRODID:[^\r\n]+\r\n/)
    expect(ics).toContain('\r\nX-WR-CALNAME:EduDesk\r\n')
    expect(ics).not.toMatch(/[^\r]\n/)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(ics.match(/END:VEVENT/g)).toHaveLength(3)
  })

  it('saatli olay İstanbul→UTC (Z) olarak yazılır', () => {
    const ics = buildIcsCalendar(events, NOW)
    expect(ics).toContain('\r\nDTSTART:20260914T050000Z\r\n')
    expect(ics).toContain('\r\nDTEND:20260914T054000Z\r\n')
  })

  it('tüm-gün olay VALUE=DATE; DTEND ertesi gün (ay sonu taşması doğru)', () => {
    const ics = buildIcsCalendar(events, NOW)
    expect(ics).toContain('\r\nDTSTART;VALUE=DATE:20260930\r\n')
    expect(ics).toContain('\r\nDTEND;VALUE=DATE:20261001\r\n')
    expect(ics).toContain('\r\nDTSTART;VALUE=DATE:20261029\r\n')
  })

  it('metin alanlarını kaçışlar ve DTSTAMP UTC yazar', () => {
    const ics = unfold(buildIcsCalendar(events, NOW))
    expect(ics).toContain('\r\nSUMMARY:Gezi\\, Müze\\; Ankara\r\n')
    expect(ics).toContain('\r\nDESCRIPTION:Satır1\\nSatır2\r\n')
    expect(ics).toContain('\r\nDTSTAMP:20260910T091530Z\r\n')
  })

  it("UID stabil (now'dan bağımsız) ve kaynak+id+tarih bazında ayırt edici", () => {
    const uids = (s: string) => [...s.matchAll(/\r\nUID:([^\r\n]+)/g)].map(m => m[1])
    const a = uids(buildIcsCalendar(events, NOW))
    const b = uids(buildIcsCalendar(events, new Date('2027-01-01T00:00:00Z')))
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(3)
    const twoDuties = uids(buildIcsCalendar([
      { ...events[0] },
      { ...events[0], date: '2026-09-21' },
    ], NOW))
    expect(new Set(twoDuties).size).toBe(2)
  })

  it('olay yoksa geçerli boş takvim döner', () => {
    const ics = buildIcsCalendar([], NOW)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
