// app/actions/mentor-takip.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import type { ActionResult } from '@/src/shared/types/index'

/** Otomatik kayıt: revalidate YOK (her tuşta sayfa yeniden çizilmesin); liste durumu bir sonraki gezinmede tazelenir. */
export async function haftaKaydet(girdi: unknown): Promise<ActionResult<{ cakisma?: boolean; updatedAt?: string }>> {
  return TakipService.kaydet(girdi)
}

const kitapSchema = z.object({ studentId: UUID, ad: z.string().trim().min(1, 'Kitap adı boş olamaz').max(120), ders: z.string().trim().max(60) })

export async function kitapEkle(studentId: string, ad: string, ders: string): Promise<ActionResult<{ kitap?: { id: string; ad: string; ders: string } }>> {
  const p = kitapSchema.safeParse({ studentId, ad, ders })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  const r = await TakipService.kitapEkle(p.data.studentId, p.data.ad, p.data.ders)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}/takip`)
  return r
}

export async function kitapSil(studentId: string, kitapId: string): Promise<ActionResult> {
  if (!UUID.safeParse(studentId).success || !UUID.safeParse(kitapId).success) return { error: 'Geçersiz ID' }
  const r = await TakipService.kitapSil(studentId, kitapId)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}/takip`)
  return r
}
