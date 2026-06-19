'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import type { ActionResult } from '@/src/shared/types/index'
import type { Slot } from '@/src/domains/schedule/scheduleMath'

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

const MAX_BYTES = 8 * 1024 * 1024 // 8MB

export async function ocrSchedule(formData: FormData): Promise<ActionResult<{ slots?: Slot[] }>> {
  const file = formData.get('image')
  if (!(file instanceof File)) return { error: 'Görüntü bulunamadı' }
  if (!file.type.startsWith('image/')) return { error: 'Yalnız görüntü dosyası yüklenebilir' }
  if (file.size === 0) return { error: 'Boş dosya' }
  if (file.size > MAX_BYTES) return { error: 'Görüntü çok büyük (en fazla 8MB)' }

  const data = new Uint8Array(await file.arrayBuffer())
  const res = await ScheduleService.ocrFromImage({ data, mediaType: file.type })
  if (res.error) return { error: res.error }
  return { slots: res.slots }
}
