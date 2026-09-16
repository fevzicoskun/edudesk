import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { gunFarki } from '@/src/domains/mentor/mentorshipMath'
import { todayLocalISO, addDaysISO } from '@/src/shared/date'

describe('gunFarki', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('bugünün tarihi verilince 0 döner', () => {
    expect(gunFarki(todayLocalISO())).toBe(0)
  })

  it('30 günden eski bir tarih 30dan büyük döner', () => {
    const eskiTarih = addDaysISO(todayLocalISO(), -31)
    expect(gunFarki(eskiTarih)).toBeGreaterThan(30)
  })

  describe('İstanbul günü UTC gününden farklıyken (gece yarısına yakın)', () => {
    beforeEach(() => {
      // 2026-01-15T22:00:00Z -> İstanbul'da (UTC+3) 2026-01-16T01:00 -> Istanbul günü 16'sı,
      // UTC günü ise hâlâ 15'i. todayLocalISO() İstanbul'u baz almalı.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-15T22:00:00.000Z'))
    })

    it('İstanbul yerel bugünü 0 döner (UTC bugünü değil)', () => {
      expect(todayLocalISO()).toBe('2026-01-16')
      expect(gunFarki('2026-01-16')).toBe(0)
    })

    it('İstanbul yerel dünü 1 döner', () => {
      expect(gunFarki('2026-01-15')).toBe(1)
    })
  })
})
