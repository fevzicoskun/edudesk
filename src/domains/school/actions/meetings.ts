'use server'

import { revalidatePath } from 'next/cache'
import { MeetingService } from '../services/MeetingService'
import type { MeetingResult } from '../types'

export async function createMeeting(_: unknown, formData: FormData): Promise<MeetingResult> {
  const title        = String(formData.get('title') ?? '').trim()
  const meeting_date = String(formData.get('meeting_date') ?? '').trim()
  const meeting_type = String(formData.get('meeting_type') ?? 'genel').trim()
  const notes        = String(formData.get('notes') ?? '').trim() || null
  const attendees    = String(formData.get('attendees') ?? '').trim() || null

  if (!title || title.length < 2) return { error: 'Toplantı adı en az 2 karakter olmalı' }
  if (!meeting_date) return { error: 'Tarih zorunlu' }

  const result = await MeetingService.createMeeting({ title, meeting_date, meeting_type, notes, attendees })
  if (result.success) {
    revalidatePath('/anasayfa')
    revalidatePath('/yonetim')
  }
  return result
}

export async function updateMeetingNotes(meetingId: string, notes: string): Promise<MeetingResult> {
  const result = await MeetingService.updateMeetingNotes(meetingId, notes)
  if (result.success) {
    revalidatePath('/anasayfa')
    revalidatePath('/yonetim')
  }
  return result
}

export async function deleteMeeting(meetingId: string): Promise<MeetingResult> {
  const result = await MeetingService.deleteMeeting(meetingId)
  if (result.success) {
    revalidatePath('/anasayfa')
    revalidatePath('/yonetim')
  }
  return result
}
