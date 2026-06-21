import { describe, it, expect } from 'vitest'
import { donemBasi } from '@/src/shared/utils'

describe('donemBasi', () => {
  it('Eylül–Aralık → o yılın 1. dönem başı (Eyl 1)', () => {
    expect(donemBasi(new Date(2026, 9, 5))).toBe('2026-09-01')   // Ekim
    expect(donemBasi(new Date(2026, 11, 15))).toBe('2026-09-01') // Aralık
  })
  it('Ocak → bir önceki yılın Eyl 1 (1. dönem devam ediyor)', () => {
    expect(donemBasi(new Date(2026, 0, 15))).toBe('2025-09-01')
  })
  it('Şubat–Ağustos → o yılın 2. dönem başı (Şub 1)', () => {
    expect(donemBasi(new Date(2026, 1, 1))).toBe('2026-02-01')  // Şubat
    expect(donemBasi(new Date(2026, 5, 21))).toBe('2026-02-01') // Haziran
    expect(donemBasi(new Date(2026, 7, 30))).toBe('2026-02-01') // Ağustos (yaz)
  })
})
