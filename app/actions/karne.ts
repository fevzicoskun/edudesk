'use server'

import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { donemBasi } from '@/src/shared/utils'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getSchoolTrends } from '@/src/domains/dashboard/queries/schoolTrends'
import { buildKarneData, type KarneData } from '@/src/domains/dashboard/lib/karne'
import { okulYoklamaAktif } from '@/src/domains/school/okulYoklama'
import { odevTakibiVerisi, odevTakibiHamVeri } from '@/src/domains/homework/queries/odevTakibiVerisi'
import { aylikRapor, raporAyi, oncekiAy, sonrakiAy, type AylikRapor } from '@/src/domains/dashboard/lib/aylikRapor'
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

export type AylikRaporPdf = AylikRapor & { schoolName: string }

export async function getAylikRapor(): Promise<AylikRaporPdf> {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) {
    throw new Error('Bu rapora erişim yetkiniz yok')
  }
  const sid = profile.school_id
  const supabase = await createClient()
  const ham = await odevTakibiHamVeri(supabase, sid)
  const ay = raporAyi(ham.bugun)
  const gecen = oncekiAy(ay)
  // Türkiye sabit UTC+3; ay sınırı İstanbul gününe göre
  const bultenSay = async (bas: string, son: string) => {
    const { count, error } = await supabase.from('bulten_gonderimleri')
      .select('student_id', { count: 'exact', head: true })
      .eq('school_id', sid).gte('created_at', `${bas}-01T00:00:00+03:00`).lt('created_at', `${son}-01T00:00:00+03:00`)
    if (error) throw new Error('Bülten sayısı okunamadı')
    return count ?? 0
  }
  const [bu, gecenBulten] = await Promise.all([bultenSay(ay, sonrakiAy(ay)), bultenSay(gecen, ay)])
  return { schoolName: profile.schools?.name ?? 'Okul', ...aylikRapor({ ...ham, ay, bulten: { bu, gecen: gecenBulten } }) }
}
