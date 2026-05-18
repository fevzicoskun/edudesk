import { MeetingRepository } from '../repositories/MeetingRepository'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logAudit } from '@/src/shared/audit'

async function requireBaskan() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'zumre_baskani') {
    throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')
  }
  return profile
}

export const MeetingService = {
  async createMeeting(data: {
    title: string
    meeting_date: string
    notes: string | null
    branch: string | null
  }) {
    const caller = await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await MeetingRepository.insertMeeting({
      ...data,
      branch: data.branch ?? caller.subject ?? null,
      created_by: user.id,
      school_id,
    })

    await logAudit({
      user_id: user.id,
      action: 'meeting.create',
      table_name: 'zumre_meetings',
      new_data: { title: data.title },
      school_id,
    })
  },

  async updateMeeting(id: string, data: {
    title: string
    meeting_date: string
    notes: string | null
  }) {
    await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await MeetingRepository.updateMeeting(id, school_id, data)
  },

  async deleteMeeting(id: string) {
    await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await MeetingRepository.softDeleteMeeting(id, school_id, user.id)

    await logAudit({
      user_id: user.id,
      action: 'meeting.delete',
      table_name: 'zumre_meetings',
      record_id: id,
      school_id,
    })
  },

  async restoreMeeting(id: string) {
    await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await MeetingRepository.restoreMeeting(id, school_id)

    await logAudit({
      user_id: user.id,
      action: 'meeting.restore',
      table_name: 'zumre_meetings',
      record_id: id,
      school_id,
    })
  },
}
