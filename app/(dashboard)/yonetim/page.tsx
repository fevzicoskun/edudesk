import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { format } from '@/src/shared/date'
import SchoolMeetings from '../anasayfa/SchoolMeetings'
import MudurStatsWidget from '../anasayfa/MudurStatsWidget'
import BugunYoklamaWidget from './BugunYoklamaWidget'
import UyariBandi from './UyariBandi'
import OkulSeviyesiKartlari from './OkulSeviyesiKartlari'

export const revalidate = 0

function CardSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800 ${tall ? 'h-64' : 'h-32'}`} />
  )
}

export default async function YonetimPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'mudur') redirect('/anasayfa')

  const supabase = await createClient()
  const { data } = await supabase
    .from('school_meetings')
    .select('id, title, meeting_date, meeting_type, attendees, notes')
    .eq('school_id', profile.school_id!)
    .order('meeting_date', { ascending: false })

  const meetings = data ?? []

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* Başlık */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Okul Genel Bakış</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {profile.full_name ?? ''} · {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {/* Kademe kartları */}
      <Suspense fallback={<CardSkeleton />}>
        <OkulSeviyesiKartlari />
      </Suspense>

      {/* Uyarı bandı — sadece uyarı varsa render edilir */}
      <Suspense fallback={null}>
        <UyariBandi />
      </Suspense>

      {/* Bugünkü yoklama */}
      <div id="bugun-yoklama">
        <Suspense fallback={<CardSkeleton />}>
          <BugunYoklamaWidget />
        </Suspense>
      </div>

      {/* Genel istatistikler */}
      <Suspense fallback={<CardSkeleton />}>
        <MudurStatsWidget />
      </Suspense>

      {/* Toplantı kayıtları */}
      <div id="toplanti-kayitlari">
        <SchoolMeetings initial={meetings} />
      </div>

    </div>
  )
}
