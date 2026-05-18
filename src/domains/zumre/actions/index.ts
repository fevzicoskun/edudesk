'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { UUID, createMeetingSchema, createExamSchema, createCurriculumProgressSchema, curriculumStatusSchema } from '@/lib/validation'
import { MeetingService } from '../services/MeetingService'
import { ExamService } from '../services/ExamService'
import { CurriculumService } from '../services/CurriculumService'
import type { CurriculumStatus } from '../types'

// ─── Meeting Actions ──────────────────────────────────────────────────────────

export async function createMeeting(formData: FormData) {
  const parsed = createMeetingSchema.safeParse({
    title:        formData.get('title'),
    meeting_date: formData.get('meeting_date'),
    notes:        formData.get('notes') || null,
    branch:       formData.get('branch') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  await MeetingService.createMeeting({ ...parsed.data, notes: parsed.data.notes ?? null, branch: parsed.data.branch ?? null })
  revalidatePath('/zumre')
}

export async function updateMeeting(id: string, formData: FormData) {
  UUID.parse(id)
  const parsed = createMeetingSchema.safeParse({
    title:        formData.get('title'),
    meeting_date: formData.get('meeting_date'),
    notes:        formData.get('notes') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  await MeetingService.updateMeeting(id, { ...parsed.data, notes: parsed.data.notes ?? null })
  revalidatePath('/zumre')
  redirect('/zumre?tab=toplanti')
}

export async function deleteMeeting(id: string, _: FormData) {
  UUID.parse(id)
  await MeetingService.deleteMeeting(id)
  revalidatePath('/zumre')
}

// ─── Exam Actions ─────────────────────────────────────────────────────────────

export async function createExam(formData: FormData) {
  const parsed = createExamSchema.safeParse({
    title:     formData.get('title'),
    subject:   formData.get('subject'),
    exam_date: formData.get('exam_date'),
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  await ExamService.createExam(parsed.data)
  revalidatePath('/zumre')
}

export async function createExamReturning(formData: FormData): Promise<
  | { id: string; title: string; subject: string; exam_date: string; grades: number[] | null; grade_map: { name: string; grade: string }[] | null }
  | { error: string }
> {
  const parsed = createExamSchema.safeParse({
    title:     formData.get('title'),
    subject:   formData.get('subject'),
    exam_date: formData.get('exam_date'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Hata' }

  const result = await ExamService.createExamReturning(parsed.data)
  if ('error' in result) return result

  revalidatePath('/zumre')
  return result
}

export async function updateExamGrades(id: string, gradesStr: string) {
  UUID.parse(id)
  const result = await ExamService.updateExamGrades(id, gradesStr)
  revalidatePath('/zumre')
  return result
}

export async function saveExamEntries(id: string, entries: { name: string; grade: string }[]) {
  UUID.parse(id)
  const result = await ExamService.saveExamEntries(id, entries)
  revalidatePath('/zumre')
  return result
}

export async function deleteExam(id: string, _: FormData) {
  UUID.parse(id)
  await ExamService.deleteExam(id)
  revalidatePath('/zumre')
}

// ─── Curriculum Actions ───────────────────────────────────────────────────────

export async function fetchClassStudents(classId: string): Promise<{ id: string; full_name: string }[]> {
  UUID.parse(classId)
  return CurriculumService.fetchClassStudents(classId)
}

export async function createCurriculumProgress(formData: FormData) {
  const parsed = createCurriculumProgressSchema.safeParse({
    class_id:    formData.get('class_id'),
    topic:       formData.get('topic'),
    week_number: formData.get('week_number') || null,
    status:      formData.get('status') || 'tamamlandi',
  })
  if (!parsed.success) {
    redirect('/zumre?tab=mufredat&error=' + encodeURIComponent(parsed.error.issues[0]?.message ?? 'hata'))
  }

  await CurriculumService.createProgress({
    ...parsed.data,
    week_number: parsed.data.week_number ?? null,
  })
  revalidatePath('/zumre')
}

export async function setCurriculumStatus(id: string, status: CurriculumStatus) {
  UUID.parse(id)
  curriculumStatusSchema.parse(status)
  await CurriculumService.setStatus(id, status)
  revalidatePath('/zumre')
}

export async function removeCurriculumProgress(id: string) {
  UUID.parse(id)
  await CurriculumService.removeProgress(id)
  revalidatePath('/zumre')
}

export async function updateCurriculumStatus(id: string, status: CurriculumStatus, _: FormData) {
  UUID.parse(id)
  curriculumStatusSchema.parse(status)
  await CurriculumService.setStatus(id, status)
  revalidatePath('/zumre')
}

export async function deleteCurriculumProgress(id: string, _: FormData) {
  UUID.parse(id)
  await CurriculumService.removeProgress(id)
  revalidatePath('/zumre')
}

export async function clearClassCurriculum(classId: string) {
  UUID.parse(classId)
  await CurriculumService.clearClassCurriculum(classId)
  revalidatePath('/zumre')
}

type ImportState = { imported?: number; skipped?: number; error?: string } | null

export async function importFromTYMM(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const subject  = String(formData.get('subject') ?? '').trim()
  const class_id = String(formData.get('class_id') ?? '').trim()

  if (!subject) return { error: 'Ders seçilmedi' }
  const uuidResult = UUID.safeParse(class_id)
  if (!uuidResult.success) return { error: 'Geçersiz sınıf ID' }

  const result = await CurriculumService.importFromTYMM(subject, class_id)
  if (!result?.error) revalidatePath('/zumre')
  return result
}
