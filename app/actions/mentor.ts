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

// ── Sınıfa Rehber Öğretmen Atama ───────────────────────────────────────────────

export async function assignClassMentor(
  classId: string,
  teacherId: string | null,
): Promise<ActionResult> {
  try {
    UUID.parse(classId)
    if (teacherId !== null) UUID.parse(teacherId)
  } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.assignClassMentor(classId, teacherId)
  if (result.error) return { error: result.error }

  revalidatePath(`/siniflar/${classId}`)
  return {}
}

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
