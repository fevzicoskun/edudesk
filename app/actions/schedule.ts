'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import type { ActionResult } from '@/src/shared/types/index'

const periodSchema = z.object({
  no:    z.number().int().min(1).max(12),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat biçimi HH:MM olmalı'),
  end:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat biçimi HH:MM olmalı'),
})

const slotSchema = z.object({
  day:      z.number().int().min(1).max(5),
  period:   z.number().int().min(1).max(12),
  class_id: z.string().uuid(),
})

const saveSchema = z.object({
  periods: z.array(periodSchema).min(1).max(12),
  slots:   z.array(slotSchema).max(60),
})

export async function saveSchedule(input: unknown): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await ScheduleService.saveMySchedule(parsed.data.periods, parsed.data.slots)
  if (result.error) return { error: result.error }

  revalidatePath('/ders-programi')
  return {}
}
