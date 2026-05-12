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
    <div className="min-h-screen bg-white">
      {/* Toolbar — hidden in print */}
      <div className="print:hidden bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <TutanakPrintButton />
        <Link href="/zumre?tab=toplanti" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Geri
        </Link>
      </div>

      {/* Tutanak body */}
      <div className="max-w-3xl mx-auto px-10 py-10 print:py-6 print:px-8">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-800 pb-6">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">T.C.</p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">MİLLÎ EĞİTİM BAKANLIĞI</p>
          <div className="mt-5">
            <h1 className="text-base font-bold text-gray-900 uppercase tracking-wide">
              {meeting.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1 font-medium">TUTANAGI</p>
          </div>
        </div>

        {/* Meta bilgiler */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8 text-sm border border-gray-200 rounded-lg p-5 print:border-gray-400">
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Tarihi:</span>
            <span className="text-gray-900">{dateStr}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Yeri:</span>
            <span className="text-gray-300 print:text-gray-400">____________________</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Saati:</span>
            <span className="text-gray-300 print:text-gray-400">____________________</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı No:</span>
            <span className="text-gray-300 print:text-gray-400">____________________</span>
          </div>
        </div>

        {/* Gündem ve kararlar */}
        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-16 min-h-64">
          {meeting.notes || <span className="text-gray-300">Toplantı notu girilmemiş.</span>}
        </div>

        {/* İmza bölümü */}
        <div className="border-t-2 border-gray-800 pt-8 mt-8">
          <p className="text-sm font-bold text-gray-800 mb-6 uppercase tracking-wide">İmza Listesi</p>
          <div className="grid grid-cols-2 gap-x-10 gap-y-8">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Ad Soyad</p>
                  <div className="border-b border-gray-400 pb-1 h-6" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Ünvan / Branş</p>
                  <div className="border-b border-gray-400 pb-1 h-6" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">İmza</p>
                  <div className="border-b border-gray-400 h-10" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 print:text-gray-400 mt-12 print:mt-8">
          EduDesk · Zümre Takip Sistemi
        </p>
      </div>
    </div>
  )
}
