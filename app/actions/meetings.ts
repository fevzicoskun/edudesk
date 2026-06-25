'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { MeetingService } from '@/src/domains/meetings/services/MeetingService'
import type { ActionResult } from '@/src/shared/types/index'

const createSchema = z.object({
  studentId: z.string().uuid('Geçersiz öğrenci'),
  meetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih'),
  period: z.number().int().min(1).max(9),
  note: z.string().trim().max(1000).nullish(),
})

const statusSchema = z.object({
  id: z.string().uuid('Geçersiz randevu kimliği'),
  status: z.enum(['planlandi', 'yapildi', 'iptal']),
})

const idSchema = z.string().uuid('Geçersiz randevu kimliği')

export async function createMeeting(input: unknown): Promise<ActionResult<{ id?: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MeetingService.create({
    studentId: parsed.data.studentId,
    meetDate: parsed.data.meetDate,
    period: parsed.data.period,
    note: parsed.data.note ?? null,
  })
  if (result.error) return { error: result.error }

  revalidatePath('/randevular')
  return { id: result.id }
}

export async function setMeetingStatus(input: unknown): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MeetingService.updateStatus(parsed.data.id, parsed.data.status)
  if (result.error) return { error: result.error }

  revalidatePath('/randevular')
  return {}
}

export async function deleteMeeting(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MeetingService.remove(parsed.data)
  if (result.error) return { error: result.error }

  revalidatePath('/randevular')
  return {}
}
