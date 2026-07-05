'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CalendarService } from '@/src/domains/calendar/services/CalendarService'
import type { ActionResult } from '@/src/shared/types/index'

const createSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli').max(200, 'Başlık en fazla 200 karakter'),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih'),
  note: z.string().trim().max(1000).nullish(),
})

const idSchema = z.string().uuid('Geçersiz etkinlik kimliği')

export async function createSchoolEvent(input: unknown): Promise<ActionResult<{ id?: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await CalendarService.createEvent({
    title: parsed.data.title,
    eventDate: parsed.data.eventDate,
    note: parsed.data.note ?? null,
  })
  if (result.error) return { error: result.error }

  revalidatePath('/takvim')
  return { id: result.id }
}

export async function deleteSchoolEvent(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await CalendarService.removeEvent(parsed.data)
  if (result.error) return { error: result.error }

  revalidatePath('/takvim')
  return {}
}
