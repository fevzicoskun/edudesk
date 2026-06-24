import { describe, it, expect } from 'vitest'
import {
  todayStr, snoozeDate, isVisibleToday, isOverdue, validateTaskTitle,
} from '@/src/domains/tasks/taskMath'

describe('taskMath', () => {
  it('todayStr yerel YYYY-MM-DD üretir', () => {
    expect(todayStr(new Date(2026, 5, 24))).toBe('2026-06-24') // ay 0-index
  })

  it('snoozeDate yarın ve gelecek hafta', () => {
    const base = new Date(2026, 5, 24)
    expect(snoozeDate(base, 'tomorrow')).toBe('2026-06-25')
    expect(snoozeDate(base, 'nextWeek')).toBe('2026-07-01')
  })

  it('isVisibleToday: tamamlanan görünmez', () => {
    expect(isVisibleToday({ done_at: '2026-06-24T10:00:00Z', snoozed_until: null }, '2026-06-24')).toBe(false)
  })

  it('isVisibleToday: gelecek ertelemesi gizli, bugün/geçmiş görünür', () => {
    expect(isVisibleToday({ done_at: null, snoozed_until: '2026-06-25' }, '2026-06-24')).toBe(false)
    expect(isVisibleToday({ done_at: null, snoozed_until: '2026-06-24' }, '2026-06-24')).toBe(true)
    expect(isVisibleToday({ done_at: null, snoozed_until: null }, '2026-06-24')).toBe(true)
  })

  it('isOverdue: açık + due_date geçmişse', () => {
    expect(isOverdue({ done_at: null, due_date: '2026-06-23' }, '2026-06-24')).toBe(true)
    expect(isOverdue({ done_at: null, due_date: '2026-06-24' }, '2026-06-24')).toBe(false)
    expect(isOverdue({ done_at: null, due_date: null }, '2026-06-24')).toBe(false)
  })

  it('validateTaskTitle: boş ve 200+ reddedilir', () => {
    expect(validateTaskTitle('   ')).not.toBeNull()
    expect(validateTaskTitle('a'.repeat(201))).not.toBeNull()
    expect(validateTaskTitle('Velileri ara')).toBeNull()
  })
})
