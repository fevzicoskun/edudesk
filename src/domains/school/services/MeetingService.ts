import { MeetingRepository } from '../repositories/MeetingRepository'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import type { MeetingResult } from '../types'

export const MeetingService = {
  async createMeeting(data: {
    title: string
    meeting_date: string
    meeting_type: string
    notes: string | null
    attendees: string | null
  }): Promise<MeetingResult> {
    const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
    if (!profile || !user || !isMudurOrAbove(profile.role)) return { error: 'Yetki yok' }
    if (!profile.school_id) return { error: 'Okul bilgisi eksik' }

    const { data: result, error } = await MeetingRepository.insertMeeting({
      school_id:    profile.school_id,
      created_by:   user.id,
      ...data,
    })

    if (error) return { error: error.message }
    return { success: true, id: result.id }
  },

  async updateMeetingNotes(meetingId: string, notes: string): Promise<MeetingResult> {
    const profile = await getCurrentProfile()
    if (!profile || !isMudurOrAbove(profile.role)) return { error: 'Yetki yok' }
    if (!profile.school_id) return { error: 'Okul bilgisi eksik' }

    const { error } = await MeetingRepository.updateMeetingNotes(meetingId, profile.school_id, notes)
    if (error) return { error: error.message }
    return { success: true }
  },

  async deleteMeeting(meetingId: string): Promise<MeetingResult> {
    const profile = await getCurrentProfile()
    if (!profile || !isMudurOrAbove(profile.role)) return { error: 'Yetki yok' }
    if (!profile.school_id) return { error: 'Okul bilgisi eksik' }

    const { error } = await MeetingRepository.deleteMeeting(meetingId, profile.school_id)
    if (error) return { error: error.message }
    return { success: true }
  },
}
