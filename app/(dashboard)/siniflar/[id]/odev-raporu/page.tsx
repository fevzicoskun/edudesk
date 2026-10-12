import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { createClient } from '@/src/infrastructure/supabase/server'
import PrintButton from '@/components/PrintButton'
import OgrenciOdevOzeti from '../ogrenciler/[studentId]/odev-raporu/OgrenciOdevOzeti'

export const metadata = { title: 'Sınıf Ödev Özetleri' }

/** Sınıftaki her öğrencinin ödev özeti alt alta; yazdırınca her öğrenci ayrı sayfa. */
export default async function SinifOdevRaporuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const supabase = await createClient()
  const [sonuc, clsRes] = await Promise.all([
    HomeworkService.getClassHomeworkProfiles(classId),
    supabase.from('classes').select('name').eq('id', classId).eq('school_id', profile.school_id).single(),
  ])
  if (!clsRes.data) notFound()
  if ('error' in sonuc) throw new Error(sonuc.error)
  const { ogrenciler } = sonuc
  const sinifAdi = clsRes.data.name

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-start justify-between gap-3 mb-4 print:hidden">
        <div>
          <Link href={`/siniflar/${classId}`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">
            ← {sinifAdi}
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-1">Tüm Öğrencilerin Ödev Özetleri</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {ogrenciler.length} öğrenci · yazdırınca her öğrenci ayrı sayfaya çıkar
          </p>
        </div>
        {ogrenciler.length > 0 && <PrintButton />}
      </div>

      {ogrenciler.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-10 text-center">Bu sınıfta öğrenci yok.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {ogrenciler.map(o => (
            <section key={o.id} aria-label={o.full_name} className="break-after-page last:break-after-auto">
              <OgrenciOdevOzeti
                okulAdi={profile.schools?.name ?? ''}
                sinifAdi={sinifAdi}
                ogrenci={o}
                homeworks={o.homeworks}
                stats={o.stats}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
