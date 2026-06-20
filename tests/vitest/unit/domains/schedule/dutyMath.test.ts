import { describe, it, expect } from 'vitest'
import { validateDuty, type DutyInput } from '@/src/domains/schedule/dutyMath'

// Geçerli temel girdi — her test bunun bir alanını bozar.
const VALID: DutyInput = {
  day_of_week: 1,
  time_range: '08:00–08:40',
  location: 'Zemin kat koridoru',
  notes: 'Kapı yanı',
}

describe('validateDuty', () => {
  it('geçerli girdiyi kabul eder (null döner)', () => {
    expect(validateDuty(VALID)).toBeNull()
  })

  it('notes boş/yoksa kabul eder (opsiyonel)', () => {
    expect(validateDuty({ ...VALID, notes: '' })).toBeNull()
    expect(validateDuty({ ...VALID, notes: null })).toBeNull()
  })

  it('gün 1-5 dışındaysa reddeder', () => {
    expect(validateDuty({ ...VALID, day_of_week: 0 })).not.toBeNull()
    expect(validateDuty({ ...VALID, day_of_week: 6 })).not.toBeNull()
    expect(validateDuty({ ...VALID, day_of_week: 2.5 })).not.toBeNull()
  })

  it('saat aralığı boşsa reddeder', () => {
    expect(validateDuty({ ...VALID, time_range: '' })).not.toBeNull()
    expect(validateDuty({ ...VALID, time_range: '   ' })).not.toBeNull()
  })

  it('saat aralığı 40 karakteri aşarsa reddeder', () => {
    expect(validateDuty({ ...VALID, time_range: 'x'.repeat(41) })).not.toBeNull()
  })

  it('nöbet yeri boşsa reddeder', () => {
    expect(validateDuty({ ...VALID, location: '' })).not.toBeNull()
    expect(validateDuty({ ...VALID, location: '   ' })).not.toBeNull()
  })

  it('nöbet yeri 100 karakteri aşarsa reddeder', () => {
    expect(validateDuty({ ...VALID, location: 'a'.repeat(101) })).not.toBeNull()
  })

  it('notes 200 karakteri aşarsa reddeder', () => {
    expect(validateDuty({ ...VALID, notes: 'n'.repeat(201) })).not.toBeNull()
  })

  it('notes tam 200 karakter kabul edilir (sınır dahil)', () => {
    expect(validateDuty({ ...VALID, notes: 'n'.repeat(200) })).toBeNull()
  })
})
