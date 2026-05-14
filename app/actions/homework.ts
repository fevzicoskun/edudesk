'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SubmissionStatus } from '@/lib/types'
import { UUID, createHomeworkSchema, submissionStatusSchema } from '@/lib/validation'

export async function createHomework(_: unknown, formData: FormData) {
  const parsed = createHomeworkSchema.safeParse({
    class_id: formData.get('class_id'),
    title: formData.get('title'),
    description: formData.get('description') || null,
    subject: formData.get('subject'),
    due_date: formData.get('due_date'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('homeworks').insert({
    teacher_id: user.id,
    ...parsed.data,
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
  UUID.parse(homeworkId)
  UUID.parse(studentId)
  submissionStatusSchema.parse(status)

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
  UUID.parse(homeworkId)
  submissionStatusSchema.parse(status)
  if (studentIds.length > 200) throw new Error('Çok fazla öğrenci')
  studentIds.forEach(id => UUID.parse(id))

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

export async function updateSubmissionNote(
  homeworkId: string,
  studentId: string,
  note: string
) {
  UUID.parse(homeworkId)
  UUID.parse(studentId)
  const sanitizedNote = String(note).slice(0, 1000).trim() || null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('homework_submissions')
    .upsert(
      { homework_id: homeworkId, student_id: studentId, note: sanitizedNote, updated_at: new Date().toISOString() },
      { onConflict: 'homework_id,student_id' }
    )
}

export async function deleteHomework(id: string) {
  UUID.parse(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('homework_submissions').delete().eq('homework_id', id)
  await supabase.from('homeworks').delete().eq('id', id).eq('teacher_id', user.id)

  revalidatePath('/odevler')
}
