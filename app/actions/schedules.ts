'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { revalidatePath } from 'next/cache'

export type ScheduleSlot = { day: number; period: number; subject: string }

type CreateScheduleInput = {
  schedule_type: 'resmi' | 'okul'
  type_label: string
  teacher_id?: string | null
  class_id?: string | null
  title?: string
  period_count?: number
}

async function authorizeEditor() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) throw new Error('Unauthorized')
  if (!['mudur', 'mudur_yardimcisi'].includes(profile.role)) throw new Error('Unauthorized')
  return { user, profile }
}

export async function createSchedule(input: CreateScheduleInput) {
  const { user } = await authorizeEditor()
  const supabase = await createClient()

  const { data, error } = await supabase.from('lesson_schedules').insert({
    schedule_type: input.schedule_type,
    type_label: input.type_label,
    teacher_id: input.teacher_id || null,
    class_id: input.class_id || null,
    title: input.title || null,
    period_count: input.period_count ?? 8,
    slots: [],
    created_by: user.id,
  }).select('id').single()

  if (error) throw error
  revalidatePath('/ders-programi')
  return data.id as string
}

export async function updateScheduleSlots(id: string, slots: ScheduleSlot[], periodCount: number) {
  await authorizeEditor()
  const supabase = await createClient()

  const { error } = await supabase.from('lesson_schedules')
    .update({ slots, period_count: periodCount })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/ders-programi')
  revalidatePath('/anasayfa')
}

export async function renameOkulTypeLabel(newLabel: string) {
  const { user } = await authorizeEditor()
  const supabase = await createClient()

  const { data: p } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!p) throw new Error('Profile not found')

  const { error } = await supabase.from('lesson_schedules')
    .update({ type_label: newLabel })
    .eq('school_id', p.school_id)
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
