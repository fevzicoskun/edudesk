import { getCurrentProfile } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'
import { SetupRepository } from '../repositories/SetupRepository'
import {
  isWithinOnboardingWindow, buildTeacherSteps, hasIncompleteStep, type SetupStep,
} from '../setupMath'

export type SetupStatus =
  | { kind: 'mudur'; code: string }
  | { kind: 'ogretmen'; steps: SetupStep[] }
  | null

// Fail-quiet: count hatası → adım done sayılır / kart gizlenir. Kart kritik yol değil.
export const SetupService = {
  async getSetupStatus(): Promise<SetupStatus> {
    const profile = await getCurrentProfile()
    if (!profile?.school_id) return null
    if (!isWithinOnboardingWindow(profile.created_at)) return null

    if (profile.role === 'mudur') {
      const { count, error } = await SetupRepository.countOtherMembers(profile.school_id)
      if (error) {
        logger.error({ event: 'setup_status_failed', userId: profile.id, err: error.message }, 'Kurulum durumu okunamadı (müdür)')
        return null
      }
      if ((count ?? 0) > 0) return null // davet tamam → kart yok
      return { kind: 'mudur', code: profile.schools?.slug ?? '' }
    }

    if (profile.role === 'ogretmen' || profile.role === 'zumre_baskani') {
      const results = await SetupRepository.teacherCounts(profile.id, profile.school_id)
      const [classes, schedule, attendance, homework] = results.map(r => {
        if (r.error) {
          logger.error({ event: 'setup_status_failed', userId: profile.id, err: r.error.message }, 'Kurulum durumu okunamadı (öğretmen)')
          return 1 // fail-quiet: hatalı adım done sayılır
        }
        return r.count ?? 0
      })
      const steps = buildTeacherSteps({ classes, schedule, attendance, homework })
      return hasIncompleteStep(steps) ? { kind: 'ogretmen', steps } : null
    }

    return null // mudur_yardimcisi / admin: kart yok
  },
}
