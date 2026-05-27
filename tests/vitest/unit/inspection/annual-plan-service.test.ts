import { describe, it, expect } from 'vitest'
import { AnnualPlanService } from '@/src/domains/inspection/services/AnnualPlanService'

describe('generateWeeklyPlan', () => {
  it('9. sınıf için 36 haftalık plan üretir', () => {
    const plan = AnnualPlanService.generateWeeklyPlan(9, '2025-2026')
    expect(plan).toHaveLength(36)
  })

  it('her haftada week, dates, topics, objectives alanları var', () => {
    const plan = AnnualPlanService.generateWeeklyPlan(10, '2025-2026')
    const first = plan[0]
    expect(first).toHaveProperty('week', 1)
    expect(first).toHaveProperty('dates')
    expect(first.topics.length).toBeGreaterThan(0)
    expect(Array.isArray(first.objectives)).toBe(true)
  })

  it('hafta numaraları 1–36 sıralı', () => {
    const plan = AnnualPlanService.generateWeeklyPlan(11, '2025-2026')
    plan.forEach((entry, i) => expect(entry.week).toBe(i + 1))
  })

  it('12. sınıf için konu listesi 9. sınıftan farklı', () => {
    const plan9  = AnnualPlanService.generateWeeklyPlan(9,  '2025-2026')
    const plan12 = AnnualPlanService.generateWeeklyPlan(12, '2025-2026')
    expect(plan9[0].topics[0]).not.toBe(plan12[0].topics[0])
  })

  it('desteklenmeyen sınıf seviyesi hata fırlatır', () => {
    expect(() => AnnualPlanService.generateWeeklyPlan(8, '2025-2026')).toThrow()
  })
})
