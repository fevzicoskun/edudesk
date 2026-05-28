import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { format } from '@/src/shared/date'
import SchoolMeetings from '../anasayfa/SchoolMeetings'
import OkulSeviyesiKartlari from './OkulSeviyesiKartlari'
import MudurStatsWidget from '../anasayfa/MudurStatsWidget'
import MudurHizliAksiyonlar from '../anasayfa/MudurHizliAksiyonlar'
import UyariBandi from './UyariBandi'

export const revalidate = 0

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
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">

      {/* Başlık */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Okul Genel Bakış</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {profile.full_name ?? ''} · {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {/* Uyarı bandı — sadece uyarı varsa render edilir */}
      <UyariBandi />

      {/* Kademe kartları */}
      <OkulSeviyesiKartlari />

      {/* Genel istatistikler + pasif öğretmen uyarısı */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Genel İstatistikler</h2>
        <MudurStatsWidget />
      </div>

      {/* Hızlı erişim */}
      <MudurHizliAksiyonlar />

      {/* Toplantı kayıtları */}
      <div id="toplanti-kayitlari">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Toplantı Kayıtları</h2>
        <SchoolMeetings initial={meetings} />
      </div>

    </div>
  )
}
