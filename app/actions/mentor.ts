'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import type { ActionResult } from '@/src/shared/types/index'

const mentorReportSchema = z.object({
  content:     z.string().min(5, 'En az 5 karakter gerekli').max(2000),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih'),
})

const mentorStudentSchema = z.object({
  full_name:   z.string().min(2, 'Ad en az 2 karakter olmalı').max(100),
  parent_name: z.string().max(100).optional(),
  phone:       z.string().max(20).optional(),
})

// ── Mentor Raporları ─────────────────────────────────────────────────────────

export async function addMentorReport(
  studentId: string,
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  try { UUID.parse(studentId); UUID.parse(classId) }
  catch { return { error: 'Geçersiz ID' } }

  const parsed = mentorReportSchema.safeParse({
    content:     formData.get('content'),
    report_date: formData.get('report_date'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MentorService.addMentorReport({
    student_id:  studentId,
    class_id:    classId,
    content:     parsed.data.content,
    report_date: parsed.data.report_date,
  })
  if (result.error) return { error: result.error }

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
  return {}
}

export async function deleteMentorReport(
  reportId: string,
  classId: string,
  studentId: string,
): Promise<ActionResult> {
  try { UUID.parse(reportId); UUID.parse(classId); UUID.parse(studentId) }
  catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.deleteMentorReport(reportId)
  if (result.error) return { error: result.error }

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
  return {}
}

// ── Kişisel Mentor Öğrenci Defteri ───────────────────────────────────────────

export async function addMentorStudent(formData: FormData): Promise<ActionResult> {
  const parsed = mentorStudentSchema.safeParse({
    full_name:   formData.get('full_name'),
    parent_name: formData.get('parent_name') || undefined,
    phone:       formData.get('phone') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MentorService.addMentorStudent(parsed.data)
  if (result.error) return { error: result.error }

  revalidatePath('/siniflar')
  return {}
}

export async function deleteMentorStudent(studentId: string): Promise<ActionResult> {
  try { UUID.parse(studentId) }
  catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.deleteMentorStudent(studentId)
  if (result.error) return { error: result.error }

  revalidatePath('/siniflar')
  return {}
}
