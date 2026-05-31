import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import SchoolMeetings from '../anasayfa/SchoolMeetings'

export const revalidate = 0

export default async function ToplantilarPage() {
  const profile = await getCurrentProfile()
  if (!profile || !['mudur', 'mudur_yardimcisi'].includes(profile.role ?? '')) redirect('/anasayfa')

  const supabase = await createClient()
  const { data } = await supabase
    .from('school_meetings')
    .select('id, title, meeting_date, meeting_type, attendees, notes')
    .eq('school_id', profile.school_id!)
    .order('meeting_date', { ascending: false })

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/yonetim"
          className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Toplantı Kayıtları</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Tüm okul toplantıları · ekle, düzenle, not al
          </p>
        </div>
      </div>

      <SchoolMeetings initial={data ?? []} />
    </div>
  )
}
