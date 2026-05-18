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

  async softDeleteMeeting(id: string, schoolId: string, deletedBy: string) {
    const supabase = await createClient()
    return supabase.from('zumre_meetings')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', id).eq('school_id', schoolId)
  },

  async restoreMeeting(id: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('zumre_meetings')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id).eq('school_id', schoolId)
  },
}
