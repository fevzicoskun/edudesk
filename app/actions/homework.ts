'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { UUID } from '@/src/shared/validation'
import { createHomeworkSchema, submissionStatusSchema } from '@/src/domains/homework/validators'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import type { SubmissionStatus } from '@/src/domains/homework/types'

export async function createHomework(_: unknown, formData: FormData) {
  const isTemplate = formData.get('is_template') === 'true'
  const parsed = createHomeworkSchema.safeParse({
    class_id:    formData.get('class_id'),
    title:       formData.get('title'),
    description: formData.get('description') || null,
    subject:     formData.get('subject'),
    due_date:    formData.get('due_date') || null,
    source_id:   formData.get('source_id') || null,
    is_template: isTemplate,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  if (!isTemplate && !parsed.data.due_date) return { error: 'Son teslim tarihi gerekli' }
  if (!isTemplate && parsed.data.due_date) {
    const today = new Date().toISOString().split('T')[0]
    if (parsed.data.due_date < today) {
      return { error: 'Son teslim tarihi bugün veya sonrası olmalı' }
    }
  }

  const result = await HomeworkService.createHomework({
    ...parsed.data,
    description: parsed.data.description ?? null,
    source_id:   parsed.data.source_id ?? null,
    due_date:    parsed.data.due_date ?? null,
  })
  if (result.error) return result

  revalidatePath('/odevler')
  if (result.id && !isTemplate) {
    redirect(`/odevler/${result.id}`)
  }
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

  const result = await HomeworkService.updateSubmissionStatus(homeworkId, studentId, status)
  if (result.success) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function updateAllSubmissionStatuses(
  homeworkId: string,
  studentIds: string[],
  status: SubmissionStatus
) {
  UUID.parse(homeworkId)
  submissionStatusSchema.parse(status)
  studentIds.forEach(id => UUID.parse(id))

  const result = await HomeworkService.updateAllSubmissionStatuses(homeworkId, studentIds, status)
  if (result.success) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function updateSubmissionNote(
  homeworkId: string,
  studentId: string,
  note: string
) {
  UUID.parse(homeworkId)
  UUID.parse(studentId)

  const result = await HomeworkService.updateSubmissionNote(homeworkId, studentId, note)
  if (result.success) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function updateHomework(_: unknown, formData: FormData) {
  const id = formData.get('id') as string
  UUID.parse(id)

  const parsed = createHomeworkSchema.omit({ class_id: true, is_template: true }).safeParse({
    title:       formData.get('title'),
    description: formData.get('description') || null,
    subject:     formData.get('subject'),
    due_date:    formData.get('due_date') || null,
    source_id:   formData.get('source_id') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await HomeworkService.updateHomework(id, {
    title:       parsed.data.title,
    subject:     parsed.data.subject,
    description: parsed.data.description ?? null,
    due_date:    parsed.data.due_date ?? null,
  })
  if (result.error) return result

  revalidatePath('/odevler')
  revalidatePath(`/odevler/${id}`)
  redirect(`/odevler/${id}`)
}

export async function deleteHomework(id: string) {
  UUID.parse(id)
  const result = await HomeworkService.deleteHomework(id)
  if (result.error) throw new Error(result.error)
  revalidatePath('/odevler')
}

export async function restoreHomework(id: string) {
  UUID.parse(id)
  const result = await HomeworkService.restoreHomework(id)
  if (result.error) throw new Error(result.error)
  revalidatePath('/odevler')
}
