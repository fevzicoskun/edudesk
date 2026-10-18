'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { BultenService } from '@/src/domains/mentor/services/BultenService'
import type { ActionResult } from '@/src/shared/types/index'

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
