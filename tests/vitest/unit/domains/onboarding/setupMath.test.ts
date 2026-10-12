import { describe, it, expect } from 'vitest'
import { isWithinOnboardingWindow } from '@/src/domains/onboarding/setupMath'

describe('setupMath', () => {
  const now = new Date('2026-07-03T12:00:00Z')

  it('isWithinOnboardingWindow: 30 gün penceresi (sınırlar dahil)', () => {
    expect(isWithinOnboardingWindow('2026-07-01T00:00:00Z', now)).toBe(true)   // 2 gün
    expect(isWithinOnboardingWindow('2026-06-03T12:00:00Z', now)).toBe(true)   // tam 30 gün
    expect(isWithinOnboardingWindow('2026-06-03T11:59:59Z', now)).toBe(false)  // 30 gün + 1sn
    expect(isWithinOnboardingWindow('2026-01-01T00:00:00Z', now)).toBe(false)  // eski hesap
  })

  it('isWithinOnboardingWindow: bozuk tarih → false (fail-quiet)', () => {
    expect(isWithinOnboardingWindow('garbage', now)).toBe(false)
  })
})
