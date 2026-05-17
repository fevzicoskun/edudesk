'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile, getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isMudurOrAbove } from '@/lib/types'

type MeetingResult = { error?: string; success?: boolean; id?: string }

export async function createMeeting(_: unknown, formData: FormData): Promise<MeetingResult> {
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile || !user || !isMudurOrAbove(profile.role)) return { error: 'Yetki yok' }
  if (!profile.school_id) return { error: 'Okul bilgisi eksik' }

  const title = String(formData.get('title') ?? '').trim()
  const meeting_date = String(formData.get('meeting_date') ?? '').trim()
  const meeting_type = String(formData.get('meeting_type') ?? 'genel').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null
  const attendees = String(formData.get('attendees') ?? '').trim() || null

  if (!title || title.length < 2) return { error: 'Toplantı adı en az 2 karakter olmalı' }
  if (!meeting_date) return { error: 'Tarih zorunlu' }

  const supabase = await createClient()
  const { data, error } = await supabase.from('school_meetings').insert({
    school_id: profile.school_id,
    created_by: user.id,
    title,
    meeting_date,
    meeting_type,
    notes,
    attendees,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/anasayfa')
  revalidatePath('/yonetim')
  return { success: true, id: data.id }
}

export async function updateMeetingNotes(meetingId: string, notes: string): Promise<MeetingResult> {
  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) return { error: 'Yetki yok' }

  const supabase = await createClient()
  const { error } = await supabase.from('school_meetings')
    .update({ notes })
    .eq('id', meetingId)
    .eq('school_id', profile.school_id!)

  if (error) return { error: error.message }
  revalidatePath('/anasayfa')
  revalidatePath('/yonetim')
  return { success: true }
}

export async function deleteMeeting(meetingId: string): Promise<MeetingResult> {
  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) return { error: 'Yetki yok' }

  const supabase = await createClient()
  const { error } = await supabase.from('school_meetings')
    .delete()
    .eq('id', meetingId)
    .eq('school_id', profile.school_id!)

  if (error) return { error: error.message }
  revalidatePath('/anasayfa')
  revalidatePath('/yonetim')
  return { success: true }
}
