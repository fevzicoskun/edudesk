import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { isMudurOrAbove } from '@/lib/types'
import SchoolMeetings from '../anasayfa/SchoolMeetings'

export const revalidate = 0

export default async function YonetimPage() {
  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) redirect('/anasayfa')

  const supabase = await createClient()
  const { data } = await supabase
    .from('school_meetings')
    .select('id, title, meeting_date, meeting_type, attendees, notes')
    .eq('school_id', profile.school_id!)
    .order('meeting_date', { ascending: false })

  const meetings = data ?? []

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yönetim Toplantıları</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Toplantı kayıtları, katılımcılar ve notlar
        </p>
      </div>

      <SchoolMeetings initial={meetings} />
    </div>
  )
}
