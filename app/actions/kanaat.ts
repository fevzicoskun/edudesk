'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod/v4'
import { KanaatService } from '@/src/domains/kanaat/services/KanaatService'

const DONEM_RE = /^\d{4}-\d{4}-(1|2)$/

const KayitSchema = z.object({
  studentId: z.string().uuid(),
  score:     z.coerce.number().int().min(1).max(5) as z.ZodType<1 | 2 | 3 | 4 | 5>,
  text:      z.string().min(1).max(2000),
})

export async function generateKanaatAction(classId: string, donem: string) {
  if (!z.string().uuid().safeParse(classId).success) return { error: 'Geçersiz sınıf ID' }
  if (!DONEM_RE.test(donem)) return { error: 'Geçersiz dönem formatı' }

  const result = await KanaatService.generateKanaatHesap(classId, donem)
  return result
}

export async function saveKanaatAction(params: {
  classId:  string
  donem:    string
  kayitlar: { studentId: string; score: 1 | 2 | 3 | 4 | 5; text: string }[]
}) {
  if (!z.string().uuid().safeParse(params.classId).success) return { error: 'Geçersiz sınıf ID' }
  if (!DONEM_RE.test(params.donem)) return { error: 'Geçersiz dönem formatı' }

  const parsed = z.array(KayitSchema).safeParse(params.kayitlar)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await KanaatService.saveKanaatKayitlari(params.classId, params.donem, parsed.data)
  if (result.error) return result

  revalidatePath(`/not-defteri/${params.classId}`)
  return {}
}

export async function getKanaatKayitlariAction(classId: string, donem: string) {
  if (!z.string().uuid().safeParse(classId).success) return { error: 'Geçersiz sınıf ID' }
  if (!DONEM_RE.test(donem)) return { error: 'Geçersiz dönem formatı' }

  return KanaatService.getKanaatKayitlari(classId, donem)
}
