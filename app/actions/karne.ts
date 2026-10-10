'use server'

import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { donemBasi } from '@/src/shared/utils'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getSchoolTrends } from '@/src/domains/dashboard/queries/schoolTrends'
import { buildKarneData, type KarneData } from '@/src/domains/dashboard/lib/karne'
import { okulYoklamaAktif } from '@/src/domains/school/okulYoklama'
import { odevTakibiVerisi } from '@/src/domains/homework/queries/odevTakibiVerisi'
import type { OdevTakibiSonucu } from '@/src/domains/homework/lib/odevKarnesi'

export type OkulKarnesi = {
  schoolName: string
  donemStart: string
  generatedAt: string
  odev: OdevTakibiSonucu
  /** okulun yoklama modülü kapalıysa null — PDF'te yoklama bölümleri olmaz */
  yoklama: KarneData | null
}

export async function getOkulKarnesi(): Promise<OkulKarnesi> {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) {
    throw new Error('Bu rapora erişim yetkiniz yok')
  }
  const sid = profile.school_id
  const schoolName = profile.schools?.name ?? 'Okul'

  const [odev, yoklamaAcik] = await Promise.all([
    odevTakibiVerisi(await createClient(), sid, null),
    okulYoklamaAktif(sid),
  ])

  let yoklama: KarneData | null = null
  if (yoklamaAcik) {
    const { absence, activity, coverage, classAbs, donemStart, now } = await getSchoolTrends(sid)
    yoklama = buildKarneData(schoolName, donemStart, absence, activity, coverage, classAbs, now)
  }

  return { schoolName, donemStart: donemBasi(), generatedAt: new Date().toISOString(), odev, yoklama }
}
