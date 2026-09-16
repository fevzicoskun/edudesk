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

export const metadata = { title: 'Mentörlük' }

export default async function MentorlukDetayPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/anasayfa')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  // Öğrenci gerçekten mentörlük listemde mi? Değilse sayfa yok.
  const rows = await MentorService.getMyMentorships()
  const satir = rows.find(r => r.student_id === studentId)
  if (!satir) notFound()

  const supabase = await createClient()
  const [karte, notlar, ogrenciRes] = await Promise.all([
    MentorService.getMentorProfile(studentId),
    MentorService.getMentorReportsByStudent(studentId),
    supabase.from('students').select('class_id').eq('id', studentId).eq('school_id', profile.school_id).single(),
  ])

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link href="/mentorluk" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
        ← Mentörlüğüm
      </Link>

      <div className="mt-3 mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{satir.full_name}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{satir.class_name ?? '—'}</p>
        </div>
        <ListedenCikarButonu studentId={studentId} ad={satir.full_name} />
      </div>

      <div className="space-y-6">
        <TanimaKarti studentId={studentId} profil={karte} />
        <GorusmeNotlari
          studentId={studentId}
          classId={ogrenciRes.data?.class_id ?? ''}
          notlar={notlar}
        />
        <MentorlukDuzeni studentId={studentId} anlatildiTarihi={karte?.rules_explained_at ?? null} />
      </div>
    </div>
  )
}
