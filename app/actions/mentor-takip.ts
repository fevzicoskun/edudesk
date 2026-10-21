// app/actions/mentor-takip.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { pazartesiMi } from '@/src/domains/mentor/lib/bultenMath'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import type { ActionResult } from '@/src/shared/types/index'
import type { HaftaVerisi } from '@/src/domains/mentor/takip/takipMath'

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

const konuSchema = z.object({ studentId: UUID, ders: z.string().trim().min(1).max(60), ad: z.string().trim().min(1, 'Konu adı boş olamaz').max(120) })
export async function konuEkle(studentId: string, ders: string, ad: string): Promise<ActionResult> {
  const p = konuSchema.safeParse({ studentId, ders, ad })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  const r = await TakipService.konuEkle(p.data.studentId, p.data.ders, p.data.ad)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}/takip`)
  return r
}
export async function konuDurumu(studentId: string, konuId: string, durum: number): Promise<ActionResult> {
  if (!UUID.safeParse(studentId).success || !UUID.safeParse(konuId).success || ![0, 1, 2].includes(durum)) return { error: 'Geçersiz veri' }
  return TakipService.konuDurumuYaz(studentId, konuId, durum as 0 | 1 | 2)
}

const haftaSchema = z.object({ studentId: UUID, hafta: z.string().refine(pazartesiMi, 'Hafta pazartesi olmalı') })
/** Haftayı kapat: plan + sonuç + o anki okul ödevi durumu sabitlenir, hafta salt okunur olur. */
export async function haftaKapat(studentId: string, hafta: string): Promise<ActionResult> {
  const p = haftaSchema.safeParse({ studentId, hafta })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  const r = await TakipService.kapat(p.data.studentId, p.data.hafta)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}`, 'layout')
  return r
}
export async function haftaKilidiAc(studentId: string, hafta: string): Promise<ActionResult> {
  const p = haftaSchema.safeParse({ studentId, hafta })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  const r = await TakipService.kilidiAc(p.data.studentId, p.data.hafta)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}`, 'layout')
  return r
}

/** "Geçen haftayı kopyala": önceki kaydın planı (yazmaz; istemci kendi otomatik kaydıyla yazar). */
export async function oncekiPlan(studentId: string, hafta: string): Promise<ActionResult<{ veri?: HaftaVerisi; kaynak?: string }>> {
  const p = haftaSchema.safeParse({ studentId, hafta })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  return TakipService.oncekiPlan(p.data.studentId, p.data.hafta)
}

export async function herkeseUygula(studentId: string, hafta: string): Promise<ActionResult<{ uygulanan?: number; atlanan?: number }>> {
  const p = haftaSchema.safeParse({ studentId, hafta })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  const r = await TakipService.herkeseUygula(p.data.studentId, p.data.hafta)
  if (!r.error) revalidatePath('/mentorluk', 'layout')
  return r
}

/** Mentörlük ana sayfası: aynı kitabı tüm mentör öğrencilerime tanımla (olanları atla). */
export async function kitapHerkeseEkle(ad: string, ders: string): Promise<ActionResult<{ eklenen?: number; atlanan?: number }>> {
  const p = kitapSchema.omit({ studentId: true }).safeParse({ ad, ders })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  const r = await TakipService.kitapHerkese(p.data.ad, p.data.ders)
  if (!r.error) revalidatePath('/mentorluk', 'layout')
  return r
}

/** Öğrencinin çalışma saatleri (haftadan bağımsız); doğrulama serviste (saatlerSchema). */
export async function calismaSaatleriKaydet(studentId: string, saatler: unknown): Promise<ActionResult> {
  if (!UUID.safeParse(studentId).success) return { error: 'Geçersiz ID' }
  const r = await TakipService.saatleriKaydet(studentId, saatler)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}/takip`)
  return r
}
