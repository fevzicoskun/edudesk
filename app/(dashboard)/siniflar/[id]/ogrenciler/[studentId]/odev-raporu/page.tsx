import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { createClient } from '@/src/infrastructure/supabase/server'
import PrintButton from '@/components/PrintButton'
import OgrenciOdevOzeti from './OgrenciOdevOzeti'

export const metadata = { title: 'Öğrenci Ödev Özeti' }

/** Öğrencinin (görüntüleyenin kapsamındaki) tüm ödevleri — veliyle paylaşılabilir tek sayfa. */
export default async function OgrenciOdevRaporuPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>
}) {
  const { id: classId, studentId } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const supabase = await createClient()
  const [sonuc, clsRes] = await Promise.all([
    HomeworkService.getStudentHomeworkProfile(studentId, classId),
    supabase.from('classes').select('name').eq('id', classId).eq('school_id', profile.school_id).single(),
  ])
  if ('error' in sonuc) {
    if (sonuc.error === 'Öğrenci bulunamadı') notFound()
    throw new Error(sonuc.error)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link
          href={`/siniflar/${classId}/ogrenciler/${studentId}`}
          className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600"
        >
          ← Öğrenci sayfası
        </Link>
        <PrintButton />
      </div>
      <OgrenciOdevOzeti
        okulAdi={profile.schools?.name ?? ''}
        sinifAdi={clsRes.data?.name ?? ''}
        ogrenci={sonuc.student}
        homeworks={sonuc.homeworks}
        stats={sonuc.stats}
      />
    </div>
  )
}
