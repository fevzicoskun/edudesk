import { describe, it, expect } from 'vitest'
import { isYoklamaTimeLocked } from '@/src/shared/constants/attendance'

// Kilit TR saatiyle 10:30. UTC'den seçilmiş anlar TR'de (UTC+3) net saatlere düşsün diye seçildi.
describe('isYoklamaTimeLocked (TR saati, kilit 10:30)', () => {
  it('10:30 öncesi açık', () => {
    // 07:00 UTC = 10:00 TR
    expect(isYoklamaTimeLocked(new Date('2026-06-16T07:00:00Z'))).toBe(false)
  })
  it('tam 10:30 kilitli', () => {
    // 07:30 UTC = 10:30 TR
    expect(isYoklamaTimeLocked(new Date('2026-06-16T07:30:00Z'))).toBe(true)
  })
  it('10:30 sonrası kilitli', () => {
    // 09:00 UTC = 12:00 TR
    expect(isYoklamaTimeLocked(new Date('2026-06-16T09:00:00Z'))).toBe(true)
  })
})
