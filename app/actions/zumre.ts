'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { TYMM_DATA, topicToString } from '@/lib/tymm-data'
import type { CurriculumStatus } from '@/lib/types'
import {
  UUID,
  createMeetingSchema,
  createExamSchema,
  createCurriculumProgressSchema,
  curriculumStatusSchema,
} from '@/lib/validation'

async function requireBaskan() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'zumre_baskani') {
    throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')
  }
}

export async function createMeeting(formData: FormData) {
  await requireBaskan()
  const parsed = createMeetingSchema.safeParse({
    title: formData.get('title'),
    meeting_date: formData.get('meeting_date'),
    notes: formData.get('notes') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('zumre_meetings').insert({
    ...parsed.data,
    created_by: user.id,
  })

  revalidatePath('/zumre')
}

export async function createExam(formData: FormData) {
  await requireBaskan()
  const parsed = createExamSchema.safeParse({
    title: formData.get('title'),
    subject: formData.get('subject'),
    exam_date: formData.get('exam_date'),
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('common_exams').insert({
    ...parsed.data,
    created_by: user.id,
  })

  revalidatePath('/zumre')
}

export async function createCurriculumProgress(formData: FormData) {
  const parsed = createCurriculumProgressSchema.safeParse({
    class_id: formData.get('class_id'),
    topic: formData.get('topic'),
    week_number: formData.get('week_number') || null,
    status: formData.get('status') || 'tamamlandi',
  })
  if (!parsed.success) {
    redirect('/zumre?tab=mufredat&error=' + encodeURIComponent(parsed.error.issues[0]?.message ?? 'hata'))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { class_id, topic, week_number, status } = parsed.data

  await supabase.from('curriculum_progress').insert({
    teacher_id: user.id,
    class_id,
    topic,
    week_number: week_number ?? null,
    status,
    completed: status !== 'eksik_kaldi',
    completion_date: status === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
  })

  revalidatePath('/zumre')
}

export async function setCurriculumStatus(id: string, status: CurriculumStatus) {
  UUID.parse(id)
  curriculumStatusSchema.parse(status)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('curriculum_progress')
    .update({
      status,
      completed: status !== 'eksik_kaldi',
      completion_date: status === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
    })
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

export async function removeCurriculumProgress(id: string) {
  UUID.parse(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('curriculum_progress').delete().eq('id', id).eq('teacher_id', user.id)
  revalidatePath('/zumre')
}

export async function updateExamGrades(id: string, gradesStr: string) {
  UUID.parse(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const grades = gradesStr
    .split(/[,\s]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 0 && n <= 100)

  const { error } = await supabase
    .from('common_exams')
    .update({ grades })
    .eq('id', id)

  revalidatePath('/zumre')
  return { error: error?.message }
}

export async function saveExamEntries(
  id: string,
  entries: { name: string; grade: string }[]
) {
  UUID.parse(id)
  if (entries.length > 200) throw new Error('Çok fazla giriş')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const grades = entries
    .map(e => parseInt(e.grade))
    .filter(n => !isNaN(n) && n >= 0 && n <= 100)

  const safeEntries = entries.map(e => ({
    name: String(e.name).slice(0, 120),
    grade: String(e.grade).slice(0, 4),
  }))

  const { error } = await supabase
    .from('common_exams')
    .update({ grades, grade_map: safeEntries })
    .eq('id', id)

  revalidatePath('/zumre')
  return { error: error?.message }
}

export async function clearClassCurriculum(classId: string) {
  UUID.parse(classId)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('curriculum_progress')
    .delete()
    .eq('class_id', classId)
    .eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

export async function updateCurriculumStatus(id: string, status: CurriculumStatus, _: FormData) {
  UUID.parse(id)
  curriculumStatusSchema.parse(status)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('curriculum_progress')
    .update({
      status,
      completed: status !== 'eksik_kaldi',
      completion_date: status === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
    })
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

export async function updateMeeting(id: string, formData: FormData) {
  await requireBaskan()
  UUID.parse(id)
  const parsed = createMeetingSchema.safeParse({
    title: formData.get('title'),
    meeting_date: formData.get('meeting_date'),
    notes: formData.get('notes') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('zumre_meetings')
    .update(parsed.data)
    .eq('id', id)

  revalidatePath('/zumre')
  redirect('/zumre?tab=toplanti')
}

export async function deleteMeeting(id: string, _: FormData) {
  await requireBaskan()
  UUID.parse(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('zumre_meetings').delete().eq('id', id)

  revalidatePath('/zumre')
}

export async function deleteExam(id: string, _: FormData) {
  await requireBaskan()
  UUID.parse(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('common_exams').delete().eq('id', id)

  revalidatePath('/zumre')
}

export async function deleteCurriculumProgress(id: string, _: FormData) {
  UUID.parse(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('curriculum_progress').delete().eq('id', id).eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

type ImportState = { imported?: number; skipped?: number; error?: string } | null

export async function importFromTYMM(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const subject = String(formData.get('subject') ?? '').trim()
  const class_id = String(formData.get('class_id') ?? '').trim()

  if (!subject) return { error: 'Ders seçilmedi' }
  const uuidResult = UUID.safeParse(class_id)
  if (!uuidResult.success) return { error: 'Geçersiz sınıf ID' }

  const { data: cls } = await supabase.from('classes').select('grade').eq('id', class_id).single()
  if (!cls) return { error: 'Sınıf bulunamadı' }

  const tymmTopics = TYMM_DATA[subject]?.[cls.grade]
  if (!tymmTopics || tymmTopics.length === 0)
    return { error: 'Bu ders/sınıf için TYMM verisi bulunamadı' }

  const { data: existing } = await supabase
    .from('curriculum_progress')
    .select('topic')
    .eq('teacher_id', user.id)
    .eq('class_id', class_id)

  const existingSet = new Set((existing ?? []).map((r) => r.topic))

  const newTopics = tymmTopics.filter((t) => !existingSet.has(topicToString(t)))
  const skipped = tymmTopics.length - newTopics.length

  if (newTopics.length === 0)
    return { imported: 0, skipped, error: undefined }

  const rows = newTopics.map((t, i) => ({
    teacher_id: user.id,
    class_id,
    topic: topicToString(t),
    week_number: i + 1,
    status: 'tamamlandi' as const,
    completed: true,
    completion_date: null,
  }))

  const { error } = await supabase.from('curriculum_progress').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/zumre')
  return { imported: rows.length, skipped }
}
