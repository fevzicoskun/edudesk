import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { createClient } from '@/src/infrastructure/supabase/server'
import TanimaKarti from './TanimaKarti'
import GorusmeNotlari from './GorusmeNotlari'
import MentorlukDuzeni from './MentorlukDuzeni'
import ListedenCikarButonu from './ListedenCikarButonu'
import OdevDurumu from './OdevDurumu'
import CopyVeliLink from '../../siniflar/[id]/ogrenciler/[studentId]/CopyVeliLink'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { todayLocalISO } from '@/src/shared/date'
import { donemBasi } from '@/src/shared/utils'
import { basTarihi } from '@/src/domains/mentor/lib/mentorTablosu'

export const metadata = { title: 'Mentörlük' }

export default async function MentorlukDetayPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ bas?: string | string[] }>
}) {
  const { studentId } = await params
  const bas = basTarihi((await searchParams).bas, donemBasi(), todayLocalISO())
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/anasayfa')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  // Öğrenci mentörlük listemde mi? Değilse önceki öğrencim mi (salt okunur notlar)? İkisi de değilse sayfa yok.
  const rows = await MentorService.getMyMentorships()
  const simdiki = rows.find(r => r.student_id === studentId)
  const eski = simdiki ? undefined : (await MentorService.getEskiOgrencilerim()).find(r => r.student_id === studentId)
  const satir = simdiki ?? eski
  if (!satir) notFound()
  const salt = !simdiki

  const supabase = await createClient()
  const [karte, notlar, ogrenciRes] = await Promise.all([
    MentorService.getMentorProfile(studentId),
    MentorService.getMentorReportsByStudent(studentId),
    supabase.from('students').select('class_id, veli_ad').eq('id', studentId).eq('school_id', profile.school_id).single(),
  ])
  if (ogrenciRes.error || !ogrenciRes.data) throw new Error(ogrenciRes.error?.message ?? 'Öğrenci okunamadı')
  const classId = ogrenciRes.data.class_id
  // Ödev durumu yalnız güncel mentörlükte (önceki mentör yalnız kendi notlarını görür)
  const profil = salt ? null : await HomeworkService.getStudentHomeworkProfile(studentId, classId, { tumOdevler: true, bas })
  if (profil && 'error' in profil) throw new Error(profil.error)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link href={`/mentorluk?bas=${bas}`} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
        ← Mentörlüğüm
      </Link>

      <div className="mt-3 mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{satir.full_name}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{satir.class_name ?? '—'}</p>
        </div>
        {!salt && simdiki && <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/siniflar/${classId}/ogrenciler/${studentId}/odev-raporu?bas=${bas}`}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Yazdır
          </Link>
          {simdiki.idare_atadi
            ? <span className="text-xs text-gray-500 dark:text-slate-400">İdare atadı</span>
            : <ListedenCikarButonu studentId={studentId} ad={satir.full_name} />}
        </div>}
      </div>

      {salt && (
        <p role="status" className="mb-6 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-gray-700 dark:text-slate-300">
          Bu öğrencinin mentörlüğü artık sizde değil. Kendi notlarınızı ve tanıma kartınızı yalnız okuyabilirsiniz.
        </p>
      )}

      <div className="space-y-6">
        {profil && <OdevDurumu homeworks={profil.homeworks} />}
        {!salt && <CopyVeliLink studentId={studentId} studentName={satir.full_name} veliAd={ogrenciRes.data.veli_ad} />}
        <TanimaKarti studentId={studentId} profil={karte} salt={salt} />
        <GorusmeNotlari
          studentId={studentId}
          classId={classId}
          notlar={notlar}
          salt={salt}
        />
        {!salt && <MentorlukDuzeni studentId={studentId} anlatildiTarihi={karte?.rules_explained_at ?? null} />}
      </div>
    </div>
  )
}
