'use server'

import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { getSchoolTrends } from '@/src/domains/dashboard/queries/schoolTrends'
import { buildKarneData, type KarneData } from '@/src/domains/dashboard/lib/karne'

export async function getOkulKarnesi(): Promise<KarneData> {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) {
    throw new Error('Bu rapora erişim yetkiniz yok')
  }
  const schoolName = profile.schools?.name ?? 'Okul'

  const { absence, activity, coverage, classAbs, donemStart, now } = await getSchoolTrends(profile.school_id)

  return buildKarneData(schoolName, donemStart, absence, activity, coverage, classAbs, now)
}
