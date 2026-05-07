'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createMeeting(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('zumre_meetings').insert({
    title: formData.get('title') as string,
    meeting_date: formData.get('meeting_date') as string,
    notes: (formData.get('notes') as string) || null,
    created_by: user.id,
  })

  revalidatePath('/zumre')
}

export async function createExam(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('common_exams').insert({
    title: formData.get('title') as string,
    subject: formData.get('subject') as string,
    exam_date: formData.get('exam_date') as string,
    created_by: user.id,
  })

  revalidatePath('/zumre')
}

export async function createCurriculumProgress(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('curriculum_progress').insert({
    teacher_id: user.id,
    class_id: formData.get('class_id') as string,
    topic: formData.get('topic') as string,
    week_number: formData.get('week_number') ? Number(formData.get('week_number')) : null,
  })

  revalidatePath('/zumre')
}

export async function toggleCurriculumDone(id: string, completed: boolean, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('curriculum_progress')
    .update({ completed, completion_date: completed ? new Date().toISOString().split('T')[0] : null })
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

export async function deleteMeeting(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('zumre_meetings').delete().eq('id', id)

  revalidatePath('/zumre')
}

export async function deleteExam(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('common_exams').delete().eq('id', id)

  revalidatePath('/zumre')
}

export async function deleteCurriculumProgress(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('curriculum_progress').delete().eq('id', id).eq('teacher_id', user.id)

  revalidatePath('/zumre')
}
