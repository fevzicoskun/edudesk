import { createClient } from '@/src/infrastructure/supabase/server'

export const MeetingRepository = {
  async insertMeeting(data: {
    school_id: string
    created_by: string
    title: string
    meeting_date: string
    meeting_type: string
    notes: string | null
    attendees: string | null
  }) {
    const supabase = await createClient()
    return supabase.from('school_meetings').insert(data).select('id').single()
  },

  async updateMeetingNotes(meetingId: string, schoolId: string, notes: string) {
    const supabase = await createClient()
    return supabase
      .from('school_meetings')
      .update({ notes })
      .eq('id', meetingId)
      .eq('school_id', schoolId)
  },

  async deleteMeeting(meetingId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('school_meetings')
      .delete()
      .eq('id', meetingId)
      .eq('school_id', schoolId)
  },
}
