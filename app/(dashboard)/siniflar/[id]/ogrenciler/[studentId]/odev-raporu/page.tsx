import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { createClient } from '@/src/infrastructure/supabase/server'
import { format, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'
import PrintButton from '@/components/PrintButton'

export const metadata = { title: 'Öğrenci Ödev Özeti' }

const ETIKET: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', gec: 'Geç', eksik: 'Eksik', yapilmadi: 'Yapılmadı', mazeretli: 'Mazeretli',
}
// Sınıf raporuyla aynı renk dili: mavi yapıldı, sarı eksik, kırmızı yapılmadı
const ROZET: Record<SubmissionStatus, string> = {
  yapildi:   'bg-blue-100 text-blue-800',
  gec:       'bg-orange-100 text-orange-900',
  eksik:     'bg-yellow-200 text-yellow-900',
  yapilmadi: 'bg-red-100 text-red-800',
  mazeretli: 'bg-gray-100 text-gray-700',
}

const tarih = (iso: string | null) => (iso ? format(parseISO(iso), 'd MMM yyyy') : '—')

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
  const { student, homeworks, stats } = sonuc

  const ozet = [
    { etiket: 'Yapıldı', sayi: stats.yapildi, cls: 'text-blue-700' },
    { etiket: 'Geç', sayi: stats.gec, cls: 'text-orange-700' },
    { etiket: 'Eksik', sayi: stats.eksik, cls: 'text-yellow-800' },
    { etiket: 'Yapılmadı', sayi: stats.yapilmadi, cls: 'text-red-700' },
    { etiket: 'Mazeretli', sayi: stats.mazeretli, cls: 'text-gray-600' },
    { etiket: 'Kontrol edilmedi', sayi: stats.kontrolEdilmedi, cls: 'text-gray-500' },
  ].filter(o => o.sayi > 0)

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

      <div className="bg-white text-black rounded-xl border border-gray-200 p-5 print:border-0 print:p-0 print:rounded-none">
        {/* not: <header> kullanma — globals.css print kuralı tüm header'ları gizliyor */}
        <div className="border-b-2 border-black pb-1 mb-3 flex items-baseline justify-between">
          <h1 className="text-base font-bold">{profile.schools?.name ?? ''}</h1>
          <span className="text-sm">Öğrenci Ödev Özeti</span>
        </div>

        <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-0.5 text-[10.5pt] mb-3">
          <dt className="font-semibold">Öğrenci</dt>
          <dd>{student.full_name}</dd>
          <dt className="font-semibold">No</dt>
          <dd>{student.student_number || '—'}</dd>
          <dt className="font-semibold">Sınıf</dt>
          <dd>{clsRes.data?.name ?? '—'}</dd>
          <dt className="font-semibold">Yazdırma tarihi</dt>
          <dd>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
        </dl>

        <p className="text-[10.5pt] mb-3 pb-2 border-b border-gray-400">
          <span className="font-semibold">Toplam {stats.total} ödev: </span>
          {ozet.map((o, i) => (
            <span key={o.etiket}>
              {i > 0 && <span className="text-gray-500">  ·  </span>}
              <span className={`font-bold ${o.cls}`}>{o.sayi} {o.etiket}</span>
            </span>
          ))}
          {stats.total - stats.kontrolEdilmedi - stats.mazeretli > 0 && (
            <span className="text-gray-700"> — tamamlama %{stats.completionRate}</span>
          )}
        </p>

        {homeworks.length === 0 ? (
          <p className="text-sm text-gray-600 py-6 text-center">Bu öğrenci için kayıtlı ödev yok.</p>
        ) : (
          <table className="w-full text-[10pt] border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left font-semibold py-1 w-24">Son teslim</th>
                <th className="text-left font-semibold py-1 w-28">Ders</th>
                <th className="text-left font-semibold py-1">Ödev</th>
                <th className="text-left font-semibold py-1 w-28">Durum</th>
              </tr>
            </thead>
            <tbody>
              {homeworks.map(hw => (
                <tr key={hw.id} className="border-b border-gray-300 break-inside-avoid">
                  <td className="py-1 align-top tabular-nums whitespace-nowrap">{tarih(hw.due_date)}</td>
                  <td className="py-1 align-top">{hw.subject}</td>
                  <td className="py-1 align-top">
                    {hw.title}
                    {hw.note && <span className="block text-[8.5pt] text-gray-700">Not: {hw.note}</span>}
                  </td>
                  <td className="py-1 align-top">
                    <span className={`inline-block px-1.5 rounded font-bold whitespace-nowrap ${hw.status ? ROZET[hw.status] : 'bg-gray-50 text-gray-600'}`}>
                      {hw.status ? ETIKET[hw.status] : 'Kontrol edilmedi'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end gap-10 mt-6 text-[10pt] break-inside-avoid">
          <span>Veli imza: ______________</span>
          <span>Öğretmen imza: ______________</span>
        </div>
      </div>
    </div>
  )
}
