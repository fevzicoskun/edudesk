'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { UUID } from '@/src/shared/validation'
import { createHomeworkSchema, submissionStatusSchema } from '@/src/domains/homework/validators'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import type { SubmissionStatus, HomeworkTemplate } from '@/src/shared/types'

export async function createHomework(_: unknown, formData: FormData) {
  const isTemplate = formData.get('is_template') === 'true'

  // --- Template yolu: tek sınıf, tarih yok ---
  if (isTemplate) {
    const parsed = createHomeworkSchema.safeParse({
      class_id:    formData.get('class_id'),
      title:       formData.get('title'),
      description: formData.get('description') || null,
      subject:     formData.get('subject'),
      due_date:    null,
      source_id:   formData.get('source_id') || null,
      is_template: true,
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
    const result = await HomeworkService.createHomework({
      ...parsed.data,
      description: parsed.data.description ?? null,
      source_id:   parsed.data.source_id ?? null,
      due_date:    null,
    })
    if (result.error) return result
    revalidatePath('/odevler')
    redirect('/odevler/yeni?templateSaved=1')
  }

  // --- Normal ödev yolu: çoklu sınıf ---
  const classIds = (formData.getAll('class_id') as string[]).filter(Boolean)
  if (classIds.length === 0) return { error: 'En az bir sınıf seçin' }
  for (const id of classIds) {
    if (!UUID.safeParse(id).success) return { error: 'Geçersiz sınıf seçimi' }
  }

  const parsed = createHomeworkSchema.omit({ class_id: true }).safeParse({
    title:       formData.get('title'),
    description: formData.get('description') || null,
    subject:     formData.get('subject'),
    due_date:    formData.get('due_date') || null,
    source_id:   formData.get('source_id') || null,
    is_template: false,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  if (!parsed.data.due_date) return { error: 'Son teslim tarihi gerekli' }
  const today = new Date().toISOString().split('T')[0]
  if (parsed.data.due_date < today) return { error: 'Son teslim tarihi bugün veya sonrası olmalı' }

  const results = await Promise.allSettled(
    classIds.map(classId =>
      HomeworkService.createHomework({
        class_id:    classId,
        title:       parsed.data.title,
        description: parsed.data.description ?? null,
        subject:     parsed.data.subject,
        due_date:    parsed.data.due_date ?? null,
        source_id:   parsed.data.source_id ?? null,
        is_template: false,
      })
    )
  )

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<{ id?: string; error?: string }> =>
      r.status === 'fulfilled' && !r.value.error
    )
    .map(r => r.value.id!)
    .filter(Boolean)

  const failedCount = results.length - succeeded.length

  if (succeeded.length === 0) return { error: 'Ödev oluşturulamadı' }

  revalidatePath('/odevler')
  if (classIds.length === 1 && failedCount === 0) redirect(`/odevler/${succeeded[0]}`)
  if (failedCount > 0) redirect(`/odevler?olusturuldu=${succeeded.length}&hatali=${failedCount}`)
  redirect(`/odevler?olusturuldu=${succeeded.length}`)
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
    source_id:   parsed.data.source_id ?? null,
  })
  if (result.error) return result

  revalidatePath('/odevler')
  revalidatePath(`/odevler/${id}`)
  redirect(`/odevler/${id}?guncellendi=1`)
}

export async function deleteHomework(id: string): Promise<{ error?: string }> {
  UUID.parse(id)
  const result = await HomeworkService.deleteHomework(id)
  if (result.error) return { error: result.error }
  revalidatePath('/odevler')
  return {}
}

export async function restoreHomework(id: string): Promise<{ error?: string }> {
  UUID.parse(id)
  const result = await HomeworkService.restoreHomework(id)
  if (result.error) return { error: result.error }
  revalidatePath('/odevler')
  return {}
}

export async function getStudentHomeworkProfile(studentId: string, classId: string) {
  UUID.parse(studentId)
  UUID.parse(classId)
  return HomeworkService.getStudentHomeworkProfile(studentId, classId)
}

export async function getHomeworkTemplates(classId: string): Promise<HomeworkTemplate[]> {
  UUID.parse(classId)
  return HomeworkService.getTemplatesByClass(classId)
}
