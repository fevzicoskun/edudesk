'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSchoolId, getCurrentProfile } from '@/lib/auth'
import type { SubmissionStatus } from '@/lib/types'
import { isTeachingRole } from '@/lib/types'
import { UUID, createHomeworkSchema, submissionStatusSchema } from '@/lib/validation'

export async function createHomework(_: unknown, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || !isTeachingRole(profile.role)) return { error: 'Bu işlem için yetkiniz yok.' }

  const parsed = createHomeworkSchema.safeParse({
    class_id: formData.get('class_id'),
    title: formData.get('title'),
    description: formData.get('description') || null,
    subject: formData.get('subject'),
    due_date: formData.get('due_date'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('homeworks').insert({
    teacher_id: user.id,
    school_id,
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

  const profile = await getCurrentProfile()
  if (!profile || !isTeachingRole(profile.role)) return { error: 'Bu işlem için yetkiniz yok.' }

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hw } = await supabase
    .from('homeworks').select('teacher_id')
    .eq('id', homeworkId).eq('school_id', school_id).single()
  if (!hw) return { error: 'Ödev bulunamadı' }
  if (hw.teacher_id !== user.id && profile.role !== 'zumre_baskani') {
    return { error: 'Bu ödev için yetkiniz yok' }
  }

  const { error } = await supabase
    .from('homework_submissions')
    .upsert(
      { homework_id: homeworkId, student_id: studentId, status, school_id, updated_at: new Date().toISOString() },
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

  const profile = await getCurrentProfile()
  if (!profile || !isTeachingRole(profile.role)) return { error: 'Bu işlem için yetkiniz yok.' }

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hw } = await supabase
    .from('homeworks').select('teacher_id')
    .eq('id', homeworkId).eq('school_id', school_id).single()
  if (!hw) return { error: 'Ödev bulunamadı' }
  if (hw.teacher_id !== user.id && profile.role !== 'zumre_baskani') {
    return { error: 'Bu ödev için yetkiniz yok' }
  }

  const rows = studentIds.map((studentId) => ({
    homework_id: homeworkId,
    student_id: studentId,
    school_id,
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

  const profile = await getCurrentProfile()
  if (!profile || !isTeachingRole(profile.role)) return

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hw } = await supabase
    .from('homeworks').select('teacher_id')
    .eq('id', homeworkId).eq('school_id', school_id).single()
  if (!hw || (hw.teacher_id !== user.id && profile.role !== 'zumre_baskani')) return

  await supabase
    .from('homework_submissions')
    .upsert(
      { homework_id: homeworkId, student_id: studentId, note: sanitizedNote, school_id, updated_at: new Date().toISOString() },
      { onConflict: 'homework_id,student_id' }
    )
}

export async function deleteHomework(id: string) {
  UUID.parse(id)

  const profile = await getCurrentProfile()
  if (!profile || !isTeachingRole(profile.role)) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('homework_submissions').delete().eq('homework_id', id)
  await supabase.from('homeworks').delete().eq('id', id).eq('teacher_id', user.id)

  revalidatePath('/odevler')
}
