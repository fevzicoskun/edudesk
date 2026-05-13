'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TYMM_DATA, topicToString } from '@/lib/tymm-data'

type CurriculumStatus = 'tamamlandi' | 'tekrar_gerekli' | 'eksik_kaldi'

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

  const class_id = formData.get('class_id') as string
  if (!class_id) redirect('/zumre?tab=mufredat&error=sinif')

  await supabase.from('curriculum_progress').insert({
    teacher_id: user.id,
    class_id,
    topic: formData.get('topic') as string,
    week_number: formData.get('week_number') ? Number(formData.get('week_number')) : null,
    status: (formData.get('status') as CurriculumStatus) || 'tamamlandi',
    completed: formData.get('status') !== 'eksik_kaldi',
    completion_date:
      formData.get('status') === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
  })

  revalidatePath('/zumre')
}

export async function setCurriculumStatus(id: string, status: CurriculumStatus) {
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('curriculum_progress').delete().eq('id', id).eq('teacher_id', user.id)
  revalidatePath('/zumre')
}

export async function clearClassCurriculum(classId: string) {
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('zumre_meetings')
    .update({
      title: formData.get('title') as string,
      meeting_date: formData.get('meeting_date') as string,
      notes: (formData.get('notes') as string) || null,
    })
    .eq('id', id)

  revalidatePath('/zumre')
  redirect('/zumre?tab=toplanti')
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

type ImportState = { imported?: number; skipped?: number; error?: string } | null

export async function importFromTYMM(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const subject = formData.get('subject') as string
  const class_id = formData.get('class_id') as string

  if (!subject) return { error: 'Ders seçilmedi' }
  if (!class_id) return { error: 'Sınıf seçilmedi' }

  const { data: cls } = await supabase.from('classes').select('grade').eq('id', class_id).single()
  if (!cls) return { error: 'Sınıf bulunamadı' }

  const tymmTopics = TYMM_DATA[subject]?.[cls.grade]
  if (!tymmTopics || tymmTopics.length === 0)
    return { error: 'Bu ders/sınıf için TYMM verisi bulunamadı' }

  // Mevcut konuları çek — duplicate atlamak için
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
