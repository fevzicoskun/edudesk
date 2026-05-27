// src/domains/inspection/services/InspectionService.ts
import { InspectionRepository } from '../repositories/InspectionRepository'
import { getCurrentProfile } from '@/src/shared/auth'
import type { CompletionStatus } from '../types'

function getTermStart(term: 1 | 2, academicYear: string): string {
  const startYear = parseInt(academicYear.split('-')[0], 10)
  return term === 1
    ? `${startYear}-09-01`
    : `${startYear + 1}-02-01`
}

function getCurrentTerm(): { term: 1 | 2; academicYear: string; termStart: string } {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const term: 1 | 2 = month >= 9 || month <= 1 ? 1 : 2
  const startYear = month >= 9 ? year : year - 1
  const academicYear = `${startYear}-${startYear + 1}`
  return { term, academicYear, termStart: getTermStart(term, academicYear) }
}

export const InspectionService = {
  async getCompletionStatus(
    existing: { zumreCount: number; examCount: number },
  ): Promise<CompletionStatus> {
    const profile = await getCurrentProfile()
    if (!profile) throw new Error('Profil bulunamadı')

    const { term, academicYear, termStart } = getCurrentTerm()

    const [dailyRes, annualRes, sokRes, notebookRes] = await Promise.all([
      InspectionRepository.countDailyPlansThisTerm(profile.id, profile.school_id, termStart),
      InspectionRepository.findAnnualPlan(profile.id, academicYear, profile.subject ?? 'Matematik'),
      InspectionRepository.countSokReportsThisTerm(profile.id, profile.school_id, term, academicYear),
      InspectionRepository.countNotebookChecksThisTerm(profile.id, profile.school_id, termStart),
    ])

    const flags = {
      dailyPlans:     (dailyRes.count ?? 0) > 0,
      annualPlan:     annualRes.data !== null,
      zumreMeetings:  existing.zumreCount > 0,
      commonExams:    existing.examCount  > 0,
      sokReports:     (sokRes.count ?? 0) > 0,
      notebookChecks: (notebookRes.count ?? 0) > 0,
    }

    const presentCount = Object.values(flags).filter(Boolean).length
    const score = Math.round((presentCount / 6) * 100)

    return { ...flags, score }
  },
}
