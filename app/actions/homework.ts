'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SubmissionStatus } from '@/lib/types'

export async function createHomework(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('homeworks').insert({
    teacher_id: user.id,
    class_id: formData.get('class_id') as string,
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    subject: formData.get('subject') as string,
    due_date: formData.get('due_date') as string,
  })

  if (error) return { error: error.message }

  revalidatePath('/odevler')
  redirect('/odevler')
}

export async function updateSubmissionStatus(
  homeworkId: string,
  studentId: string,
  status: SubmissionStatus
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('homework_submissions')
    .upsert(
      { homework_id: homeworkId, student_id: studentId, status, updated_at: new Date().toISOString() },
      { onConflict: 'homework_id,student_id' }
    )

  if (error) return { error: error.message }

  revalidatePath(`/odevler/${homeworkId}`)
  return { success: true }
}

export async function updateAllSubmissionStatuses(
  homeworkId: string,
  studentIds: string[],
  status: SubmissionStatus
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rows = studentIds.map((studentId) => ({
    homework_id: homeworkId,
    student_id: studentId,
    status,
    updated_at: new Date().toISOString(),
  }))

  if (rows.length === 0) return { success: true }

  const { error } = await supabase
    .from('homework_submissions')
    .upsert(rows, { onConflict: 'homework_id,student_id' })

  if (error) return { error: error.message }

  revalidatePath(`/odevler/${homeworkId}`)
  return { success: true }
}

export async function deleteHomework(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('homework_submissions').delete().eq('homework_id', id)
  await supabase.from('homeworks').delete().eq('id', id).eq('teacher_id', user.id)

  revalidatePath('/odevler')
}
