export type RiskLevel = 'high' | 'medium' | 'low'

export function computeRiskLevel(hwMisses: number, absences: number): RiskLevel {
  if (hwMisses >= 3 || absences >= 3) return 'high'
  if (hwMisses >= 2 || absences >= 2) return 'medium'
  return 'low'
}

export function computeRiskScore(hwMisses: number, absences: number): number {
  const hwScore = Math.max(0, Math.min(hwMisses / 5, 1)) * 60
  const attScore = Math.max(0, Math.min(absences / 5, 1)) * 40
  return Math.round(hwScore + attScore)
}
