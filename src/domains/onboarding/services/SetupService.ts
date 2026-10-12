import { getCurrentProfile } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'
import { SetupRepository } from '../repositories/SetupRepository'
import { isWithinOnboardingWindow } from '../setupMath'

export type SetupStatus =
  | { kind: 'mudur'; code: string }
  | null

// Fail-quiet: count hatası → kart gizlenir. Yalnız müdür kartı var (öğretmen kartı 2026-10-12 kaldırıldı). Kart kritik yol değil.
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

    return null // diğer roller: kart yok
  },
}
