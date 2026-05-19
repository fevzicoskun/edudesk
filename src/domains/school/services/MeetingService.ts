import { MeetingRepository } from '../repositories/MeetingRepository'
import { getCurrentUser } from '@/src/shared/auth'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import type { MeetingResult } from '../types'

export const MeetingService = {
  async createMeeting(data: {
    title:        string
    meeting_date: string
    meeting_type: string
    notes:        string | null
    attendees:    string | null
  }): Promise<MeetingResult> {
    const [ability, user] = await Promise.all([getAbility(), getCurrentUser()])
    if (!ability || !user) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.SCHOOL.UPDATE)) return { error: 'Yetki yok' }

    const { data: result, error } = await MeetingRepository.insertMeeting({
      school_id:  ability.schoolId,
      created_by: user.id,
      ...data,
    })
    if (error) return { error: error.message }
    return { success: true, id: result.id }
  },

  async updateMeetingNotes(meetingId: string, notes: string): Promise<MeetingResult> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.SCHOOL.UPDATE)) return { error: 'Yetki yok' }

    const { error } = await MeetingRepository.updateMeetingNotes(meetingId, ability.schoolId, notes)
    if (error) return { error: error.message }
    return { success: true }
  },

  async deleteMeeting(meetingId: string): Promise<MeetingResult> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.SCHOOL.UPDATE)) return { error: 'Yetki yok' }

    const { error } = await MeetingRepository.deleteMeeting(meetingId, ability.schoolId)
    if (error) return { error: error.message }
    return { success: true }
  },
}
