import { describe, it, expect } from 'vitest'
import { todayWeekdayTR } from '@/src/shared/date'

// todayWeekdayTR: Intl çıktısını 1=Pzt…7=Paz'a eşler. Eşleme tablosundaki bir typo 0 döndürür.
// Bağımsız bir referansla (sv-SE tarih → Date → getDay) karşılaştırarak off-by-one/typo yakalanır.
describe('todayWeekdayTR', () => {
  it('1–7 aralığında, hiç 0 (eşleme boşluğu) döndürmez', () => {
    const wd = todayWeekdayTR()
    expect(wd).toBeGreaterThanOrEqual(1)
    expect(wd).toBeLessThanOrEqual(7)
  })

  it('Europe/Istanbul gününe denk gelir (Pzt=1…Paz=7)', () => {
    const iso = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date())
    const jsDay = new Date(`${iso}T12:00:00Z`).getUTCDay() // 0=Paz…6=Cmt
    const expected = jsDay === 0 ? 7 : jsDay
    expect(todayWeekdayTR()).toBe(expected)
  })
})
