import { createClient } from '@/src/infrastructure/supabase/server'
import type { Announcement, AnnouncementWithSender } from '../types'

export const AnnouncementRepository = {
  async getFirstUnread(userId: string, userRole: string, schoolId: string): Promise<AnnouncementWithSender | null> {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_first_unread_announcement', {
      p_user_id:   userId,
      p_user_role: userRole,
      p_school_id: schoolId,
    })
    return (data?.[0] as AnnouncementWithSender) ?? null
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

  async listBySchool(schoolId: string): Promise<AnnouncementWithSender[]> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(6)

    const rows = data ?? []
    if (rows.length === 0) return []

    const creatorIds = [...new Set(rows.map(r => r.created_by))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', creatorIds)

    const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name]))
    return rows.map(r => ({ ...r, sender_name: nameMap.get(r.created_by) ?? 'Bilinmiyor' }))
  },
}
