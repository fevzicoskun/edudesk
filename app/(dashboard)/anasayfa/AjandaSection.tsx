import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import AjandaWidget from './AjandaWidget'

export default async function AjandaSection() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()
  const { data }  = await supabase
    .from('school_meetings')
    .select('id, title, meeting_date, meeting_type, attendees, notes')
    .eq('school_id', school_id)
    .order('meeting_date', { ascending: false })
  return <AjandaWidget initial={data ?? []} />
}
