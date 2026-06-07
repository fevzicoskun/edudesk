'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { UUID } from '@/src/shared/validation'
import { createHomeworkSchema, submissionStatusSchema } from '@/src/domains/homework/validators'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import type { SubmissionStatus, HomeworkTemplate, ActionResult } from '@/src/shared/types'
import type { SubmissionLogEntry } from '@/src/domains/homework/repositories/HomeworkRepository'
import { inngest } from '@/src/infrastructure/inngest'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { weekRange, buildClassWeekLoad, type ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import { turkeyDate } from '@/src/lib/email-utils'

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
  const today = turkeyDate()
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

export async function quickCreateHomework(
  formData: FormData
): Promise<ActionResult<{ ids?: string[] }>> {
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
    source_id:   null,
    is_template: false,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  if (!parsed.data.due_date) return { error: 'Son teslim tarihi gerekli' }

  const today = turkeyDate()
  if (parsed.data.due_date < today) return { error: 'Son teslim tarihi bugün veya sonrası olmalı' }

  const results = await Promise.allSettled(
    classIds.map(classId =>
      HomeworkService.createHomework({
        class_id:    classId,
        title:       parsed.data.title,
        description: parsed.data.description ?? null,
        subject:     parsed.data.subject,
        due_date:    parsed.data.due_date!,
        source_id:   null,
        is_template: false,
      })
    )
  )

  const ids = results
    .filter((r): r is PromiseFulfilledResult<{ id?: string; error?: string }> =>
      r.status === 'fulfilled' && !r.value.error
    )
    .map(r => r.value.id!)
    .filter(Boolean)

  if (ids.length === 0) return { error: 'Ödev oluşturulamadı' }

  // Veli bildirimi — notify_parents flag true ise Inngest event fire et
  const notifyParents = formData.get('notify_parents') === 'true'
  if (notifyParents && ids.length > 0) {
    const profile = await getCurrentProfile()
    if (profile?.school_id) {
      await Promise.allSettled(
        classIds.slice(0, ids.length).map((classId, idx) =>
          inngest.send({
            name: 'homework/created',
            data: { homeworkId: ids[idx], classId, schoolId: profile.school_id! },
          })
        )
      )
    }
  }

  revalidatePath('/odevler')
  revalidatePath('/anasayfa')
  return { ids }
}

export async function updateSubmissionStatus(
  homeworkId: string,
  studentId: string,
  status: SubmissionStatus
) {
  if (!UUID.safeParse(homeworkId).success || !UUID.safeParse(studentId).success) return { error: 'Geçersiz istek' }
  if (!submissionStatusSchema.safeParse(status).success) return { error: 'Geçersiz durum değeri' }

  const result = await HomeworkService.updateSubmissionStatus(homeworkId, studentId, status)
  if (!('error' in result)) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function updateAllSubmissionStatuses(
  homeworkId: string,
  studentIds: string[],
  status: SubmissionStatus
) {
  if (!UUID.safeParse(homeworkId).success) return { error: 'Geçersiz istek' }
  if (!submissionStatusSchema.safeParse(status).success) return { error: 'Geçersiz durum değeri' }
  if (studentIds.some(id => !UUID.safeParse(id).success)) return { error: 'Geçersiz öğrenci listesi' }

  const result = await HomeworkService.updateAllSubmissionStatuses(homeworkId, studentIds, status)
  if (!('error' in result)) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function updateSubmissionNote(
  homeworkId: string,
  studentId: string,
  note: string
) {
  if (!UUID.safeParse(homeworkId).success || !UUID.safeParse(studentId).success) return { error: 'Geçersiz istek' }

  const result = await HomeworkService.updateSubmissionNote(homeworkId, studentId, note)
  if (!('error' in result)) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function updateHomework(_: unknown, formData: FormData) {
  const id          = formData.get('id') as string
  const class_id    = formData.get('class_id') as string
  const is_template = formData.get('is_template') === 'true'
  if (!UUID.safeParse(id).success)       return { error: 'Geçersiz istek' }
  if (!UUID.safeParse(class_id).success) return { error: 'Geçersiz sınıf' }

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
    class_id,
  })
  if (result.error) return result

  revalidatePath('/odevler')
  revalidatePath('/odevler/yeni')
  if (is_template) redirect('/odevler/yeni?guncellendi=1')
  revalidatePath(`/odevler/${id}`)
  redirect(`/odevler/${id}?guncellendi=1`)
}

export async function deleteHomework(id: string): Promise<ActionResult> {
  if (!UUID.safeParse(id).success) return { error: 'Geçersiz istek' }
  const result = await HomeworkService.deleteHomework(id)
  if (result.error) return { error: result.error }
  revalidatePath('/odevler')
  return {}
}

export async function bulkDeleteHomeworks(ids: string[]): Promise<{ deleted: number; error?: string }> {
  const validIds = ids.filter(id => UUID.safeParse(id).success)
  if (validIds.length === 0) return { deleted: 0 }
  const ability = await getAbility()
  if (!ability) return { deleted: 0, error: 'Giriş gerekli' }
  if (ability.cannot(P.HOMEWORK.DELETE)) return { deleted: 0, error: 'Bu işlem için yetkiniz yok.' }
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('homeworks')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', validIds)
    .eq('teacher_id', ability.userId)
    .eq('school_id', ability.schoolId)
    .is('deleted_at', null)
  if (error) return { deleted: 0, error: error.message }
  revalidatePath('/odevler')
  return { deleted: count ?? validIds.length }
}

export async function restoreHomework(id: string): Promise<ActionResult> {
  if (!UUID.safeParse(id).success) return { error: 'Geçersiz istek' }
  const result = await HomeworkService.restoreHomework(id)
  if (result.error) return { error: result.error }
  revalidatePath('/odevler')
  return {}
}

export async function getStudentHomeworkProfile(studentId: string, classId: string) {
  if (!UUID.safeParse(studentId).success || !UUID.safeParse(classId).success) return { error: 'Geçersiz istek', data: null }
  return HomeworkService.getStudentHomeworkProfile(studentId, classId)
}

export async function getHomeworkTemplates(classId: string): Promise<HomeworkTemplate[]> {
  if (!UUID.safeParse(classId).success) return []
  return HomeworkService.getTemplatesByClass(classId)
}

export async function getSubmissionLogs(
  homeworkId: string,
  studentId:  string,
): Promise<SubmissionLogEntry[]> {
  if (!UUID.safeParse(homeworkId).success || !UUID.safeParse(studentId).success) return []
  return HomeworkService.getSubmissionLogs(homeworkId, studentId)
}

export async function getClassWeekLoad(
  classIds: string[],
  weekOf: string,
): Promise<ClassWeekLoad[]> {
  if (!classIds.length || !weekOf) return []

  // Geçersiz UUID veya hatalı tarih formatı → erken çık
  const validIds = classIds.filter(id => UUID.safeParse(id).success)
  if (!validIds.length) return []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) return []

  const [user, profile, supabase] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    createClient(),
  ])
  if (!user || !profile?.school_id) return []

  const { start, end } = weekRange(weekOf)

  const { data, error } = await supabase
    .from('homeworks')
    .select('subject, due_date, class_id, teacher_id, teacher:profiles(full_name), classes(id, name)')
    .eq('school_id', profile.school_id)
    .in('class_id', validIds)
    .eq('is_template', false)
    .is('deleted_at', null)
    .gte('due_date', start)
    .lte('due_date', end)

  if (error || !data) return []

  const classNameMap = new Map<string, string>()
  for (const hw of data) {
    const cls = (hw.classes as unknown) as { id: string; name: string } | null
    if (cls) classNameMap.set(cls.id, cls.name)
  }

  return validIds.map(classId => {
    const rows = data.filter(hw =>
      (hw.class_id as string) === classId && hw.due_date !== null
    )
    return buildClassWeekLoad(
      rows.map(hw => ({
        subject: (hw.subject as string | null) ?? '',
        due_date: hw.due_date as string,
        teacher_id: hw.teacher_id as string,
        teacher_name:
          (((hw.teacher as unknown) as { full_name: string } | null)?.full_name) ?? 'Bilinmiyor',
      })),
      classId,
      classNameMap.get(classId) ?? '',
      user.id,
    )
  })
}
