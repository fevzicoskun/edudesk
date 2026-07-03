import { describe, it, expect } from 'vitest'
import {
  isWithinOnboardingWindow, buildTeacherSteps, hasIncompleteStep,
} from '@/src/domains/onboarding/setupMath'

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

  it('buildTeacherSteps: count>0 olan adım done', () => {
    const steps = buildTeacherSteps({ classes: 2, schedule: 0, attendance: 0, homework: 1 })
    expect(steps.map(s => [s.key, s.done])).toEqual([
      ['classes', true], ['schedule', false], ['attendance', false], ['homework', true],
    ])
    expect(steps.every(s => s.href.startsWith('/'))).toBe(true)
  })

  it('hasIncompleteStep: tümü done → false, biri eksik → true', () => {
    const all = buildTeacherSteps({ classes: 1, schedule: 1, attendance: 1, homework: 1 })
    expect(hasIncompleteStep(all)).toBe(false)
    const one = buildTeacherSteps({ classes: 1, schedule: 1, attendance: 1, homework: 0 })
    expect(hasIncompleteStep(one)).toBe(true)
  })
})
