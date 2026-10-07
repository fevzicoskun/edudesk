import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { yazdirmaBasligi, donemBasi } from '@/src/shared/utils'
import { todayLocalISO, format, parseISO } from '@/src/shared/date'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { basTarihi } from '@/src/domains/mentor/lib/mentorTablosu'
import PrintButton from '@/components/PrintButton'
import OgrenciOdevOzeti from '../../siniflar/[id]/ogrenciler/[studentId]/odev-raporu/OgrenciOdevOzeti'

export const metadata = { title: yazdirmaBasligi('Mentör Öğrencileri Ödev Özetleri') }

/** Mentörün tüm öğrencileri, öğrenci başına bir A4 (veli toplantısı / öğrenci görüşmesi). */
export default async function MentorYazdirPage({ searchParams }: { searchParams: Promise<{ bas?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const bas = basTarihi((await searchParams).bas, donemBasi(), todayLocalISO())
  const rows = await MentorService.getMyMentorships()
  const sonuc = await HomeworkService.getMentorHomeworkProfiles(rows.map(r => r.student_id), bas)
  if ('error' in sonuc) throw new Error(sonuc.error)
  const kapsam = `Mentör: ${profile.full_name ?? ''} · ${format(parseISO(bas), 'd MMM yyyy')} – bugün`

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-start justify-between gap-3 mb-4 print:hidden">
        <div>
          <Link href={`/mentorluk?bas=${bas}`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-1">Öğrencilerimin Ödev Özetleri</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{sonuc.ogrenciler.length} öğrenci · yazdırınca her öğrenci ayrı sayfaya çıkar</p>
        </div>
        {sonuc.ogrenciler.length > 0 && <PrintButton />}
      </div>
      {sonuc.ogrenciler.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-10 text-center">Mentörlük listende öğrenci yok.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {sonuc.ogrenciler.map(o => (
            <section key={o.id} aria-label={o.full_name} className="break-after-page last:break-after-auto">
              <OgrenciOdevOzeti okulAdi={profile.schools?.name ?? ''} sinifAdi={o.class_name ?? ''} ogrenci={o} homeworks={o.homeworks} stats={o.stats} kapsam={kapsam} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
