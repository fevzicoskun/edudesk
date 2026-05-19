'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { revalidatePath } from 'next/cache'

async function authorizeEditor() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) throw new Error('Unauthorized')
  if (!['mudur', 'mudur_yardimcisi'].includes(profile.role)) throw new Error('Unauthorized')
  return { user, profile }
}

export async function createScheduleWithFile(input: {
  schedule_type: 'resmi' | 'okul'
  type_label: string
  teacher_id?: string | null
  class_id?: string | null
  file_url: string
  file_name: string
}) {
  const { user, profile } = await authorizeEditor()
  const supabase = await createClient()

  const { error } = await supabase.from('lesson_schedules').insert({
    school_id: profile.school_id,
    schedule_type: input.schedule_type,
    type_label: input.type_label,
    teacher_id: input.teacher_id || null,
    class_id: input.class_id || null,
    file_url: input.file_url,
    file_name: input.file_name,
    slots: [],
    period_count: 8,
    created_by: user.id,
  })

  if (error) throw error
  revalidatePath('/ders-programi')
  revalidatePath('/anasayfa')
}

export async function updateScheduleFile(id: string, file_url: string, file_name: string) {
  await authorizeEditor()
  const supabase = await createClient()
  const { error } = await supabase.from('lesson_schedules')
    .update({ file_url, file_name })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/ders-programi')
  revalidatePath('/anasayfa')
}

export async function renameOkulTypeLabel(newLabel: string) {
  const { profile } = await authorizeEditor()
  const supabase = await createClient()
  const { error } = await supabase.from('lesson_schedules')
    .update({ type_label: newLabel })
    .eq('school_id', profile.school_id)
    .eq('schedule_type', 'okul')
  if (error) throw error
  revalidatePath('/ders-programi')
}

export async function deleteSchedule(id: string) {
  await authorizeEditor()
  const supabase = await createClient()
  const { error } = await supabase.from('lesson_schedules').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/ders-programi')
  revalidatePath('/anasayfa')
}
