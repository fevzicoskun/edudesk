'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { BultenService } from '@/src/domains/mentor/services/BultenService'
import type { ActionResult } from '@/src/shared/types/index'

const mentorReportSchema = z.object({
  content:     z.string().min(5, 'En az 5 karakter gerekli').max(2000),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih'),
})

// ── İdare: öğrenci bazlı mentör atama ─────────────────────────────────────────

const atamaSchema = z.object({
  classId:    UUID,
  studentIds: z.array(UUID).min(1, 'Öğrenci seçilmedi').max(200),
  mentorId:   UUID.nullable(),
})

export async function assignMentors(
  classId: string,
  studentIds: string[],
  mentorId: string | null,
): Promise<ActionResult> {
  const parsed = atamaSchema.safeParse({ classId, studentIds, mentorId })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MentorService.assignMentors(parsed.data.studentIds, parsed.data.mentorId)
  if (result.error) return { error: result.error }

  revalidatePath(`/siniflar/${classId}`)
  revalidatePath('/mentorluk')
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
    content:     parsed.data.content,
    report_date: parsed.data.report_date,
  })
  if (result.error) return { error: result.error }

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
  revalidatePath(`/mentorluk/${studentId}`)
  revalidatePath('/mentorluk') // listedeki "son görüşme" rozeti
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
  revalidatePath(`/mentorluk/${studentId}`)
  revalidatePath('/mentorluk') // listedeki "son görüşme" rozeti
  return {}
}

// ── Mentörlük listesi ────────────────────────────────────────────────────────

export async function addMentorship(studentId: string): Promise<ActionResult> {
  try { UUID.parse(studentId) } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.addMentorship(studentId)
  if (result.error) return { error: result.error }

  revalidatePath('/mentorluk')
  return {}
}

export async function removeMentorship(studentId: string): Promise<ActionResult> {
  try { UUID.parse(studentId) } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.removeMentorship(studentId)
  if (result.error) return { error: result.error }

  revalidatePath('/mentorluk')
  revalidatePath(`/mentorluk/${studentId}`)
  return {}
}

// ── Tanıma kartı ─────────────────────────────────────────────────────────────

export async function saveMentorProfile(studentId: string, formData: FormData): Promise<ActionResult> {
  try { UUID.parse(studentId) } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.saveMentorProfile(studentId, {
    goals_short:       String(formData.get('goals_short') ?? ''),
    goals_long:        String(formData.get('goals_long') ?? ''),
    interests:         String(formData.get('interests') ?? ''),
    family_info:       String(formData.get('family_info') ?? ''),
    study_environment: String(formData.get('study_environment') ?? ''),
    special_note:      String(formData.get('special_note') ?? ''),
    support_request:   String(formData.get('support_request') ?? ''),
  })
  if (result.error) return { error: result.error }

  revalidatePath(`/mentorluk/${studentId}`)
  return {}
}

export async function markRulesExplained(studentId: string): Promise<ActionResult> {
  try { UUID.parse(studentId) } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.markRulesExplained(studentId)
  if (result.error) return { error: result.error }

  revalidatePath(`/mentorluk/${studentId}`)
  return {}
}

// ── Haftalık bülten gönderim işareti ─────────────────────────────────────────

const bultenSchema = z.object({
  studentId:  UUID,
  hafta:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz hafta'),
  gonderildi: z.boolean(),
})

export async function bultenGonderildi(studentId: string, hafta: string, gonderildi: boolean): Promise<ActionResult> {
  const parsed = bultenSchema.safeParse({ studentId, hafta, gonderildi })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await BultenService.gonderildiIsaretle(parsed.data.studentId, parsed.data.hafta, parsed.data.gonderildi)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}
