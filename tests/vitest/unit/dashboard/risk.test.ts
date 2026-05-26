import { describe, it, expect } from 'vitest'
import { computeRiskLevel, computeRiskScore } from '@/src/domains/dashboard/risk'

describe('computeRiskLevel', () => {
  it('3+ ödev miss → high', () => {
    expect(computeRiskLevel(3, 0)).toBe('high')
  })
  it('3+ devamsızlık → high', () => {
    expect(computeRiskLevel(0, 3)).toBe('high')
  })
  it('2 ödev miss → medium', () => {
    expect(computeRiskLevel(2, 0)).toBe('medium')
  })
  it('2 devamsızlık → medium', () => {
    expect(computeRiskLevel(0, 2)).toBe('medium')
  })
  it('1 ödev miss → low', () => {
    expect(computeRiskLevel(1, 0)).toBe('low')
  })
  it('0 miss 0 devamsız → low', () => {
    expect(computeRiskLevel(0, 0)).toBe('low')
  })
  it('hw high devamsız medium → high', () => {
    expect(computeRiskLevel(3, 2)).toBe('high')
  })
})

describe('computeRiskScore', () => {
  it('5 miss 5 devamsız → 100', () => {
    expect(computeRiskScore(5, 5)).toBe(100)
  })
  it('0 miss 0 devamsız → 0', () => {
    expect(computeRiskScore(0, 0)).toBe(0)
  })
  it('3 miss 0 devamsız → 36', () => {
    expect(computeRiskScore(3, 0)).toBe(36)
  })
  it('0 miss 3 devamsız → 24', () => {
    expect(computeRiskScore(0, 3)).toBe(24)
  })
  it('negatif miss → 0 (clamp)', () => {
    expect(computeRiskScore(-5, 0)).toBe(0)
  })
  it('negatif devamsız → 0 (clamp)', () => {
    expect(computeRiskScore(0, -3)).toBe(0)
  })
})
