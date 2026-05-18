import { createClient } from '@/src/shared/supabase/server'

export const MeetingRepository = {
  async insertMeeting(data: {
    title: string
    meeting_date: string
    notes: string | null
    branch: string | null
    created_by: string
    school_id: string
  }) {
    const supabase = await createClient()
    return supabase.from('zumre_meetings').insert(data)
  },

  async updateMeeting(id: string, schoolId: string, data: {
    title: string
    meeting_date: string
    notes: string | null
    branch?: string | null
  }) {
    const supabase = await createClient()
    return supabase.from('zumre_meetings').update(data).eq('id', id).eq('school_id', schoolId)
  },

  async deleteMeeting(id: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('zumre_meetings').delete().eq('id', id).eq('school_id', schoolId)
  },
}
