import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hatirlatmaAdaylari } from '@/src/domains/notifications/lib/hatirlatmaAdaylari'

// Çarşamba 7 Ekim 2026 10:00 İstanbul
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T07:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

const odev = (id: string, teacher: string, due: string) =>
  ({ id, title: id, due_date: due, school_id: 'sc', teacher_id: teacher, class_id: 'c1' })

describe('hatirlatmaAdaylari', () => {
  it('tercihi hiç kaydedilmemiş öğretmen varsayılanla (1 gün önce, e-posta açık) hatırlatma alır', () => {
    const sonuc = hatirlatmaAdaylari([odev('h1', 't1', '2026-10-08')], new Map(), new Map([['t1', 't1@x']]))
    expect(sonuc).toHaveLength(1)
    expect(sonuc[0]).toMatchObject({ homeworkId: 'h1', emailOn: true, daysBefore: 1, teacherEmail: 't1@x' })
  })

  it('kayıtlı tercih varsayılanın önüne geçer (3 gün önce, e-posta kapalı)', () => {
    const prefs = new Map([['t1', { days_before: 3, email_on: false }]])
    const odevler = [odev('yarin', 't1', '2026-10-08'), odev('uc-gun', 't1', '2026-10-10')]
    const sonuc = hatirlatmaAdaylari(odevler, prefs, new Map())
    expect(sonuc.map(s => s.homeworkId)).toEqual(['uc-gun'])
    expect(sonuc[0].emailOn).toBe(false)
  })
})
