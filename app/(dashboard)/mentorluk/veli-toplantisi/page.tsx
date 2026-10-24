import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import { VeliToplantisiService } from '@/src/domains/mentor/deneme/VeliToplantisiService'
import PrintButton from '@/components/PrintButton'
import VeliToplantisiKagidi from '../[studentId]/veli-toplantisi/VeliToplantisiKagidi'

// Chrome "PDF olarak kaydet" dosya adı
export const metadata: Metadata = { title: { absolute: 'Veli Toplantısı Kâğıtları' } }

/** Mentörün bütün öğrencilerinin veli toplantısı kâğıtları, öğrenci başına yeni sayfadan. */
export default async function VeliToplantisiKagitlariPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  if (!(await TakipService.acikMi())) notFound()
  const rows = await MentorService.getMyMentorships()
  // ponytail: öğrenci başına birkaç sorgu; 40+ öğrencide toplu sorguya geç
  const veriler = (await Promise.all(rows.map(r => VeliToplantisiService.veri(r.student_id))))
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.ogrenci.ad.localeCompare(b.ogrenci.ad, 'tr'))
  return (
    <div className="p-4 md:p-6 max-w-[210mm] mx-auto print:p-0 print:max-w-none">
      <style>{'@page { size: A4; margin: 0 } @media print { body { padding: 12mm !important } }'}</style>
      <div className="flex justify-between items-start mb-4 print:hidden">
        <div>
          <Link href="/mentorluk" className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
          <h1 className="text-lg font-bold mt-1">Veli toplantısı kâğıtları</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{veriler.length} öğrenci</p>
        </div>
        {veriler.length > 0 && <PrintButton />}
      </div>
      {veriler.length === 0
        ? <p className="text-sm text-gray-500 dark:text-slate-400 py-10 text-center">Mentörlüğünde öğrenci yok.</p>
        : veriler.map(v => (
            <section key={v.ogrenci.id} aria-label={v.ogrenci.ad} className="kagit bg-white text-gray-900 break-after-page last:break-after-auto mb-8 p-[12mm] shadow-lg print:mb-0 print:p-0 print:shadow-none">
              <VeliToplantisiKagidi v={v} />
            </section>
          ))}
    </div>
  )
}
