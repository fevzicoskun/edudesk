import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { todayLocalISO } from '@/src/shared/date'

/** Mentör takip kapısı kapalıyken deneme aksiyonlarının yanıtı (servis ve aksiyon aynı metni döner). */
export const KAPALI = 'Bu özellik henüz açık değil.'

const dersSonucu = z.object({ kod: z.string().min(1).max(4), ss: z.number(), d: z.number(), y: z.number(), n: z.number() })

/** denemeKaydet girdisi (trust boundary): onizlemeden gelir ama istemciden geçtiği için tamamen doğrulanır. */
export const denemeKaydetSema = z.object({
  tur: z.enum(['TM', 'FKB', 'TCD']),
  seviye: z.number().int().min(9).max(12),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih').refine(t => t <= todayLocalISO(), 'Sınav tarihi bugünden ileri olamaz'),
  sinifId: UUID,
  sinavId: UUID.optional(),
  sonuclar: z.array(z.object({
    studentId: UUID,
    dersler: z.array(dersSonucu).min(1).max(3),
    toplamNet: z.number(),
    puan: z.number().nullable(),
  })).max(60),
})
export type DenemeKaydetGirdi = z.infer<typeof denemeKaydetSema>
