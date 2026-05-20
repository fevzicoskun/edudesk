'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { schoolMeetingSchema } from '@/src/domains/school/validators'
import { MeetingService } from '@/src/domains/school/services/MeetingService'

export async function createMeeting(_: unknown, formData: FormData) {
  const parsed = schoolMeetingSchema.safeParse({
    title:        formData.get('title'),
    meeting_date: formData.get('meeting_date'),
    meeting_type: formData.get('meeting_type') ?? 'genel',
    notes:        formData.get('notes') || null,
    attendees:    formData.get('attendees') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MeetingService.createMeeting({
    ...parsed.data,
    notes:     parsed.data.notes     ?? null,
    attendees: parsed.data.attendees ?? null,
  })
  if (result.error) return result

  revalidatePath('/yonetim')
  return { success: true }
}

export async function updateMeetingNotes(meetingId: string, notes: string) {
  UUID.parse(meetingId)
  const result = await MeetingService.updateMeetingNotes(meetingId, notes)
  if (result.success) revalidatePath('/yonetim')
  return result
}

export async function deleteMeeting(meetingId: string) {
  UUID.parse(meetingId)
  const result = await MeetingService.deleteMeeting(meetingId)
  if (result.success) revalidatePath('/yonetim')
  return result
}
