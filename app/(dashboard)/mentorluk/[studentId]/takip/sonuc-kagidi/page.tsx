import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { haftaBasi, haftaBaslangicMi, ozetHesapla } from '@/src/domains/mentor/takip/takipMath'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import PrintButton from '@/components/PrintButton'
import SonucKagidi from '../SonucKagidi'

export const metadata = { title: 'Haftalık Sonuç' }

export default async function SonucKagidiPage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ hafta?: string }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const { studentId } = await params
  const h = (await searchParams).hafta
  const v = await TakipService.sayfaVerisi(studentId, h && haftaBaslangicMi(h) ? h : haftaBasi(todayLocalISO()))
  if (!v) notFound()
  // Yalnız mentör görür (kâğıda çıkmaz): hafta kapatılmadı ya da hiçbir görev işaretlenmedi
  const eksik = !v.kayit?.kapaliAt || ozetHesapla(v.taslak.icerik).gorev_yapilan === 0
  return (
    <div className="p-4 md:p-6 print:p-0">
      {/* Kâğıt boşluğu @page ile değil body dolgusuyla: @page kenarı > 0 olunca Chrome tarih/URL basar (globals.css) */}
      <style>{'@page { size: A4; margin: 0 } @media print { body { padding: 12mm !important } }'}</style>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4 max-w-[210mm] mx-auto print:hidden">
        <Link href={`/mentorluk/${studentId}/takip?hafta=${v.hafta}&sekme=sonuc`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Sonuca dön</Link>
        <div className="flex flex-wrap items-center gap-2">
          {eksik && (
            <p role="status" className="text-sm rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-900 px-3 py-1.5">
              Bu haftanın sonuçları henüz tam girilmemiş olabilir. Yazdırmadan önce kontrol edin.
            </p>
          )}
          <PrintButton />
        </div>
      </div>
      {/* Ekranda A4 önizleme: koyu temada da beyaz kâğıt, koyu yazı */}
      <div className="overflow-x-auto print:overflow-visible">
        <div className="w-[210mm] min-h-[297mm] mx-auto bg-white text-gray-900 shadow-lg p-[12mm] print:w-auto print:min-h-0 print:shadow-none print:p-0">
          <SonucKagidi v={v} veri={v.taslak} />
        </div>
      </div>
    </div>
  )
}
