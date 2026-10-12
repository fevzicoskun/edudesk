import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { format, parseISO } from '@/src/shared/date'
import PrintButton from '@/components/PrintButton'
import { METHOD_LABELS } from '../../iletisimYontemi'

export const metadata = { title: 'Veli Görüşme Tutanağı' }

/** Veli iletişim kaydından imzalanabilir A4 tutanak. Görünürlük öğrenci sayfasıyla aynı (pcl_school_read). */
export default async function GorusmeTutanagiPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string; logId: string }>
}) {
  const { id: classId, studentId, logId } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')
  const schoolId = profile.school_id

  const supabase = await createClient()
  const [logRes, ogrRes, sinifRes] = await Promise.all([
    supabase.from('parent_contact_logs').select('note, contact_method, contacted_at, teacher_id')
      .eq('id', logId).eq('student_id', studentId).eq('school_id', schoolId).maybeSingle(),
    supabase.from('students').select('full_name, student_number, veli_ad, veli_telefon')
      .eq('id', studentId).eq('class_id', classId).eq('school_id', schoolId).maybeSingle(),
    supabase.from('classes').select('name').eq('id', classId).eq('school_id', schoolId).maybeSingle(),
  ])
  for (const r of [logRes, ogrRes, sinifRes]) if (r.error) throw new Error(r.error.message)
  const log = logRes.data
  const ogr = ogrRes.data
  if (!log || !ogr) notFound()

  const { data: ogretmen } = await supabase.from('profiles').select('full_name').eq('id', log.teacher_id).maybeSingle()
  const ogretmenAdi = ogretmen?.full_name ?? ''

  const satir = (etiket: string, deger: string | null | undefined) => (
    <>
      <dt className="font-semibold">{etiket}</dt>
      <dd className="border-b border-dotted border-gray-500 min-h-[1.4em]">{deger || ''}</dd>
    </>
  )

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href={`/siniflar/${classId}/ogrenciler/${studentId}`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">
          ← Öğrenci sayfası
        </Link>
        <PrintButton />
      </div>

      <article className="bg-white text-black rounded-xl border border-gray-200 p-6 print:border-0 print:p-0 print:rounded-none text-[11pt]">
        {/* not: <header> kullanma — globals.css print kuralı tüm header'ları gizliyor */}
        <div className="text-center border-b-2 border-black pb-2 mb-5">
          <p className="text-[12pt] font-bold">{profile.schools?.name ?? ''}</p>
          <h1 className="text-[15pt] font-bold tracking-wide mt-1">VELİ GÖRÜŞME TUTANAĞI</h1>
        </div>

        <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-2 mb-6">
          {satir('Görüşme tarihi', format(parseISO(log.contacted_at), 'd MMMM yyyy'))}
          {satir('Görüşme şekli', METHOD_LABELS[log.contact_method] ?? log.contact_method)}
          {satir('Öğrenci', ogr.full_name)}
          {satir('Sınıf / No', [sinifRes.data?.name, ogr.student_number].filter(Boolean).join(' / '))}
          {satir('Veli', ogr.veli_ad)}
          {satir('Veli telefonu', ogr.veli_telefon)}
          {satir('Görüşen öğretmen', ogretmenAdi)}
          {satir('Yakınlık', null)}
        </dl>

        <h2 className="font-bold mb-1">Görüşme konusu ve notlar</h2>
        <p className="whitespace-pre-wrap border border-gray-400 rounded p-3 min-h-[45mm] mb-6">{log.note}</p>

        <h2 className="font-bold mb-1">Alınan kararlar</h2>
        <div className="mb-10" aria-label="Alınan kararlar için boş satırlar">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="border-b border-dotted border-gray-500 h-[9mm]" />)}
        </div>

        <div className="grid grid-cols-2 gap-10 text-center break-inside-avoid">
          {[['Öğretmen', ogretmenAdi], ['Veli', ogr.veli_ad ?? '']].map(([rol, ad]) => (
            <div key={rol}>
              <p className="font-semibold">{rol}</p>
              <p className="min-h-[1.4em]">{ad}</p>
              <div className="border-b border-black h-[18mm]" />
              <p className="text-[9pt] text-gray-600 mt-1">İmza</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}
