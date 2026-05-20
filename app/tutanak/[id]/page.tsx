import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import { format, parseISO } from '@/src/shared/date'
import Link from 'next/link'
import TutanakPrintClient from './TutanakPrintClient'

export default async function TutanakPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const supabase = await createClient()

  const { data: meeting } = await supabase
    .from('zumre_meetings')
    .select('title, meeting_date, notes')
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .single()

  if (!meeting) notFound()

  const dateStr = format(parseISO(meeting.meeting_date), 'd MMMM yyyy')
  const okulAdi = profile?.schools?.name ?? ''
  const ogretmenAdi = profile?.full_name ?? ''

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body { font-size: 11px !important; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        {/* Geri butonu — yazdırmada gizle */}
        <div className="print:hidden px-6 py-2 border-b border-gray-100">
          <Link href="/zumre?tab=toplanti" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Geri
          </Link>
        </div>

        <TutanakPrintClient
          meeting={meeting}
          dateStr={dateStr}
          defaultOkulAdi={okulAdi}
          defaultOgretmenAdi={ogretmenAdi}
        />
      </div>
    </>
  )
}
