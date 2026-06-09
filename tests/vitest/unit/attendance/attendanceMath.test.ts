import { describe, it, expect } from 'vitest'
import {
  countAbsences, formatAbsenceBadge, schoolDaysOfMonth, buildMonthGrid,
} from '@/src/domains/attendance/lib/attendanceMath'

const S1 = 'student-1', S2 = 'student-2'

describe('countAbsences()', () => {
  it('absent 1 gün, late 0.5 gün sayar', () => {
    const rows = [
      { student_id: S1, status: 'absent', date: '2026-06-08' }, // Pazartesi
      { student_id: S1, status: 'late',   date: '2026-06-09' }, // Salı
    ]
    expect(countAbsences(rows)[S1]).toEqual({ unexcused: 1.5, excused: 0 })
  })

  it('excused ayrı sayaçta toplanır, unexcused etkilenmez', () => {
    const rows = [
      { student_id: S1, status: 'excused', date: '2026-06-08' },
      { student_id: S1, status: 'excused', date: '2026-06-09' },
      { student_id: S1, status: 'absent',  date: '2026-06-10' },
    ]
    expect(countAbsences(rows)[S1]).toEqual({ unexcused: 1, excused: 2 })
  })

  it('hafta sonu satırlarını yok sayar', () => {
    const rows = [
      { student_id: S1, status: 'absent', date: '2026-06-06' }, // Cumartesi
      { student_id: S1, status: 'absent', date: '2026-06-07' }, // Pazar
    ]
    expect(countAbsences(rows)[S1]).toBeUndefined()
  })

  it('present satırlarını saymaz', () => {
    const rows = [{ student_id: S1, status: 'present', date: '2026-06-08' }]
    expect(countAbsences(rows)[S1]).toBeUndefined()
  })

  it('öğrencileri ayrı toplar', () => {
    const rows = [
      { student_id: S1, status: 'absent',  date: '2026-06-08' },
      { student_id: S2, status: 'excused', date: '2026-06-08' },
    ]
    const c = countAbsences(rows)
    expect(c[S1]).toEqual({ unexcused: 1, excused: 0 })
    expect(c[S2]).toEqual({ unexcused: 0, excused: 1 })
  })
})

describe('formatAbsenceBadge()', () => {
  it('yalnız özürsüz → "4g"', () =>
    expect(formatAbsenceBadge({ unexcused: 4, excused: 0 })).toBe('4g'))
  it('buçuklu özürsüz → "3.5g"', () =>
    expect(formatAbsenceBadge({ unexcused: 3.5, excused: 0 })).toBe('3.5g'))
  it('ikisi birden → "4g + 2ö"', () =>
    expect(formatAbsenceBadge({ unexcused: 4, excused: 2 })).toBe('4g + 2ö'))
  it('yalnız özürlü → "2ö"', () =>
    expect(formatAbsenceBadge({ unexcused: 0, excused: 2 })).toBe('2ö'))
  it('ikisi sıfır → boş string', () =>
    expect(formatAbsenceBadge({ unexcused: 0, excused: 0 })).toBe(''))
})

describe('schoolDaysOfMonth()', () => {
  it('Haziran 2026: 22 okul günü, hafta sonu yok', () => {
    const days = schoolDaysOfMonth(2026, 6)
    expect(days).toHaveLength(22)
    expect(days[0]).toBe('2026-06-01')        // Pazartesi
    expect(days).not.toContain('2026-06-06')  // Cumartesi
    expect(days).not.toContain('2026-06-07')  // Pazar
    expect(days[days.length - 1]).toBe('2026-06-30')
  })

  it('Şubat 2026 artık olmayan yıl: son gün 27 (Cumartesi 28 hariç)', () => {
    const days = schoolDaysOfMonth(2026, 2)
    expect(days[days.length - 1]).toBe('2026-02-27')
  })
})

describe('buildMonthGrid()', () => {
  it('öğrenci → tarih → status haritası kurar', () => {
    const rows = [
      { student_id: S1, status: 'absent',  date: '2026-06-08' },
      { student_id: S1, status: 'excused', date: '2026-06-09' },
      { student_id: S2, status: 'present', date: '2026-06-08' },
    ]
    const grid = buildMonthGrid(rows)
    expect(grid[S1]['2026-06-08']).toBe('absent')
    expect(grid[S1]['2026-06-09']).toBe('excused')
    expect(grid[S2]['2026-06-08']).toBe('present')
    expect(grid[S1]['2026-06-10']).toBeUndefined()
  })
})
