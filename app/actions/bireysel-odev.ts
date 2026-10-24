// app/actions/bireysel-odev.ts
'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { logger } from '@/src/infrastructure/observability/logger'
import { BireyselOdevService } from '@/src/domains/bireyselOdev/services/BireyselOdevService'

type Sonuc = { error?: string }

/** Liste ekranı + öğrenci sayfası (dinamik rota) tazelenir. */
function tazele() {
  revalidatePath('/odevler/bireysel')
  revalidatePath('/siniflar/[id]/ogrenciler/[studentId]', 'page')
}

async function calistir(ad: string, is: () => Promise<{ error?: string }>): Promise<Sonuc> {
  try {
    const r = await is()
    if (!r.error) tazele()
    return r.error ? { error: r.error } : {}
  } catch (e) {
    logger.error({ err: e instanceof Error ? e.message : String(e) }, `${ad} başarısız`)
    return { error: 'İşlem yapılamadı. Lütfen tekrar dene.' }
  }
}

export async function bireyselOdevEkle(girdi: unknown): Promise<Sonuc> {
  return calistir('bireyselOdevEkle', () => BireyselOdevService.ekle(girdi))
}

export async function bireyselOdevDuzenle(girdi: unknown): Promise<Sonuc> {
  return calistir('bireyselOdevDuzenle', () => BireyselOdevService.duzenle(girdi))
}

export async function bireyselOdevYapildi(id: string, yapildi: boolean): Promise<Sonuc> {
  if (!UUID.safeParse(id).success || typeof yapildi !== 'boolean') return { error: 'Geçersiz veri' }
  return calistir('bireyselOdevYapildi', () => BireyselOdevService.yapildi(id, yapildi))
}

export async function bireyselOdevSil(id: string): Promise<Sonuc> {
  if (!UUID.safeParse(id).success) return { error: 'Geçersiz ID' }
  return calistir('bireyselOdevSil', () => BireyselOdevService.sil(id))
}
