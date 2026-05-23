import { createClient } from '@/src/infrastructure/supabase/server'
import type { Announcement } from '../types'

export const AnnouncementRepository = {
  async getFirstUnread(userId: string, userRole: string, schoolId: string): Promise<Announcement | null> {
    const supabase = await createClient()

    const { data: reads } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', userId)

    const readIds = (reads ?? []).map(r => r.announcement_id as string)

    let query = supabase
      .from('announcements')
      .select('*')
      .eq('school_id', schoolId)
      .neq('created_by', userId)
      .contains('target_roles', [userRole])
      .order('created_at', { ascending: true })
      .limit(1)

    if (readIds.length > 0) {
      query = query.not('id', 'in', `(${readIds.join(',')})`)
    }

    const { data } = await query.maybeSingle()
    return data ?? null
  },

  async markRead(announcementId: string, userId: string): Promise<void> {
    const supabase = await createClient()
    await supabase
      .from('announcement_reads')
      .upsert(
        { announcement_id: announcementId, user_id: userId },
        { onConflict: 'announcement_id,user_id' }
      )
  },

  async create(data: {
    school_id: string
    message: string
    created_by: string
    target_roles: string[]
  }): Promise<{ error?: string }> {
    const supabase = await createClient()
    const { error } = await supabase.from('announcements').insert(data)
    return error ? { error: error.message } : {}
  },

  async listByCreator(userId: string): Promise<Announcement[]> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
}
