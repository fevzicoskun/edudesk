import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import Link from 'next/link'
import TutanakPrintButton from './PrintButton'

export default async function TutanakPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  const supabase = await createClient()

  const { data: meeting } = await supabase
    .from('zumre_meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (!meeting) notFound()

  const dateStr = format(parseISO(meeting.meeting_date), 'd MMMM yyyy', { locale: tr })

  return (
    <>
      {/* @page ile A4 kenar boşluklarını sıkıştır, tek sayfaya sığdır */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body { font-size: 11px !important; }
          .print-content { padding: 0 !important; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        {/* Toolbar — yazdırmada gizle */}
        <div className="print:hidden bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <TutanakPrintButton />
          <Link href="/zumre?tab=toplanti" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Geri
          </Link>
        </div>

        {/* Tutanak gövdesi */}
        <div className="print-content max-w-2xl mx-auto px-8 py-8 print:py-0 print:px-0">

          {/* Başlık */}
          <div className="text-center mb-4 print:mb-3 border-b-2 border-gray-800 pb-4 print:pb-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">T.C.</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">MİLLÎ EĞİTİM BAKANLIĞI</p>
            <h1 className="text-sm font-bold text-gray-900 uppercase tracking-wide mt-3 print:mt-2">
              {meeting.title}
            </h1>
            <p className="text-xs text-gray-600 mt-0.5 font-medium">TUTANAĞI</p>
          </div>

          {/* Meta bilgiler */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-4 print:mb-3 text-xs border border-gray-300 rounded p-3 print:p-2">
            <div className="flex gap-2">
              <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Tarihi:</span>
              <span className="text-gray-900">{dateStr}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Yeri:</span>
              <span className="text-gray-400">____________________</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Saati:</span>
              <span className="text-gray-400">____________________</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı No:</span>
              <span className="text-gray-400">____________________</span>
            </div>
          </div>

          {/* Gündem ve kararlar */}
          <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap mb-4 print:mb-3">
            {meeting.notes || <span className="text-gray-400">Toplantı notu girilmemiş.</span>}
          </div>

          {/* İmza bölümü */}
          <div className="border-t-2 border-gray-800 pt-3 print:pt-2">
            <p className="text-xs font-bold text-gray-800 mb-3 print:mb-2 uppercase tracking-wide">İmza Listesi</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 print:gap-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="space-y-1.5 print:space-y-1">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Ad Soyad</p>
                    <div className="border-b border-gray-400 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Ünvan / Branş</p>
                    <div className="border-b border-gray-400 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">İmza</p>
                    <div className="border-b border-gray-400 h-7 print:h-6" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-400 mt-4 print:mt-3">
            EduDesk · Zümre Takip Sistemi
          </p>
        </div>
      </div>
    </>
  )
}
