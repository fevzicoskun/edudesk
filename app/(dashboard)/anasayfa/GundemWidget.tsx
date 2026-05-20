import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { addDays } from '@/src/shared/date'
import GundemClient from './GundemClient'

export default async function GundemWidget() {
  const supabase   = await createClient()
  const school_id  = await requireSchoolId()
  const todayStr   = new Date().toISOString().split('T')[0]
  const maxDateStr = addDays(new Date(), 30).toISOString().split('T')[0]

  const { data } = await supabase
    .from('school_meetings')
    .select('id, title, meeting_date, meeting_type, attendees, notes')
    .eq('school_id', school_id)
    .gte('meeting_date', todayStr)
    .lte('meeting_date', maxDateStr)
    .order('meeting_date', { ascending: true })

  return <GundemClient initial={data ?? []} />
}
