import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { yazdirmaBasligi, donemBasi } from '@/src/shared/utils'
import { todayLocalISO, format, parseISO } from '@/src/shared/date'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { basTarihi, mentorTablosu } from '@/src/domains/mentor/lib/mentorTablosu'
import PrintButton from '@/components/PrintButton'
import MentorTablosu from '../MentorTablosu'

export const metadata = { title: yazdirmaBasligi('Mentör Grubu Ödev Durumu') }

/** Kurul / idare için tek kâğıt: öğrenci × ders tablosu + dikkat edilecekler. Yatay A4. */
export default async function MentorTabloPage({ searchParams }: { searchParams: Promise<{ bas?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const bas = basTarihi((await searchParams).bas, donemBasi(), todayLocalISO())
  const rows = await MentorService.getMyMentorships()
  const sonuc = await HomeworkService.getMentorHomeworkProfiles(rows.map(r => r.student_id), bas)
  if ('error' in sonuc) throw new Error(sonuc.error)
  const tablo = mentorTablosu(sonuc.ogrenciler.map(o => ({
    id: o.id, full_name: o.full_name, class_name: o.class_name, homeworks: o.homeworks,
  })))
  const sonGorusme = Object.fromEntries(rows.map(r => [r.student_id, r.last_report_date]))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto print:p-0 print:max-w-none">
      {/* Yalnız bu sayfa yatay basılır; tablo başlığı her sayfada tekrar eder */}
      <style>{`@page { size: A4 landscape; } thead { display: table-header-group; }`}</style>

      <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
        <Link href={`/mentorluk?bas=${bas}`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
        {tablo.satirlar.length > 0 && <PrintButton />}
      </div>

      {/* not: <header> kullanma — globals.css print kuralı tüm header'ları gizliyor */}
      <div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-5 print:border-0 print:p-0 print:rounded-none print:text-black">
        <div className="border-b-2 border-black dark:border-slate-400 pb-1 mb-3 flex items-baseline justify-between">
          <h1 className="text-base font-bold">{profile.schools?.name ?? ''}</h1>
          <span className="text-sm">Mentör Grubu Ödev Durumu</span>
        </div>
        <p className="text-[10.5pt] mb-3">
          <span className="font-semibold">Mentör:</span> {profile.full_name ?? '—'}
          <span className="text-gray-500">  ·  </span>
          {format(parseISO(bas), 'd MMM yyyy')} – bugün
          <span className="text-gray-500">  ·  </span>
          {tablo.satirlar.length} öğrenci
        </p>

        {tablo.satirlar.length === 0 ? (
          <p className="text-sm text-gray-600 py-6 text-center">Mentörlük listende öğrenci yok.</p>
        ) : (
          <MentorTablosu tablo={tablo} sonGorusme={sonGorusme} bas={bas} baglanti={false} />
        )}

        {tablo.dikkat.length > 0 && (
          <div className="mt-4 border-l-4 border-red-600 pl-3 break-inside-avoid">
            <p className="text-sm font-semibold">Dikkat edilecekler (3 ve üzeri yapılmadı/eksik)</p>
            <ul className="mt-1 text-sm">
              {tablo.dikkat.map(d => (
                <li key={d.id}>
                  {d.full_name} — <span className="text-red-700 dark:text-red-400 font-semibold">{d.toplam}</span> ({d.dersler})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-8 text-sm break-inside-avoid">
          <div><p className="font-medium">Not</p><div className="mt-8 border-b border-dashed border-gray-400" /></div>
          <div><p className="font-medium">Mentör öğretmen · İmza</p><div className="mt-8 border-b border-dashed border-gray-400" /></div>
        </div>
        <p className="mt-4 text-[9pt] text-gray-500 text-center">myedudesk.com.tr</p>
      </div>
    </div>
  )
}
