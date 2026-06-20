'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DutyService } from '@/src/domains/schedule/services/DutyService'
import type { ActionResult } from '@/src/shared/types/index'

const dutySchema = z.object({
  day_of_week: z.number().int().min(1).max(5),
  time_range: z.string().trim().min(1, 'Saat aralığı zorunludur').max(40),
  location: z.string().trim().min(1, 'Nöbet yeri zorunludur').max(100),
  notes: z.string().max(200, 'Notlar en fazla 200 karakter olabilir').nullish(),
})

export async function saveDuty(input: unknown): Promise<ActionResult> {
  const parsed = dutySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await DutyService.saveMyDuty({
    day_of_week: parsed.data.day_of_week,
    time_range: parsed.data.time_range,
    location: parsed.data.location,
    notes: parsed.data.notes ?? null,
  })
  if (result.error) return { error: result.error }

  revalidatePath('/ders-programi')
  return {}
}
