'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { UUID } from '@/src/shared/validation'
import { createHomeworkSchema, submissionStatusSchema } from '@/src/domains/homework/validators'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import type { SubmissionStatus } from '@/src/domains/homework/types'

export async function createHomework(_: unknown, formData: FormData) {
  const parsed = createHomeworkSchema.safeParse({
    class_id:    formData.get('class_id'),
    title:       formData.get('title'),
    description: formData.get('description') || null,
    subject:     formData.get('subject'),
    due_date:    formData.get('due_date'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await HomeworkService.createHomework({
    ...parsed.data,
    description: parsed.data.description ?? null,
  })
  if (result.error) return result

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

export async function deleteHomework(id: string) {
  UUID.parse(id)
  const result = await HomeworkService.deleteHomework(id)
  if (result.error) throw new Error(result.error)
  revalidatePath('/odevler')
}

export async function restoreHomework(id: string) {
  UUID.parse(id)
  await HomeworkService.restoreHomework(id)
  revalidatePath('/odevler')
}
