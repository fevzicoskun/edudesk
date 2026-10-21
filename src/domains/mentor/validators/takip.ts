import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { pazartesiMi } from '../lib/bultenMath'

const metin = (n: number) => z.string().trim().max(n)
const sayi = z.number().int().min(0).max(100_000)

const gorevSchema = z.object({
  id: z.string().min(1).max(64), gun: z.number().int().min(0).max(6), ad: metin(120).min(1, 'Görev adı boş olamaz'),
  ders: metin(60).nullable(), miktar: z.number().int().min(1).max(600).nullable(), birim: z.enum(['dk', 'soru', 'serbest']),
  soruSatiri: z.boolean(), konu: metin(120), sayfa: metin(60), yapti: z.boolean(), soru: sayi.nullable(), dogru: sayi.nullable(),
  kitapId: UUID.nullable().optional(), kitapAdi: metin(120).optional(),
  sayfaBas: z.number().int().min(1).max(5000).nullable().optional(), sayfaSon: z.number().int().min(1).max(5000).nullable().optional(),
  grup: z.string().min(1).max(80).optional(),
  odevId: UUID.optional(), teslim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(g => g.dogru === null || (g.soru !== null && g.dogru <= g.soru), { message: 'Doğru sayısı soru sayısından büyük olamaz', path: ['dogru'] })
  .refine(g => g.sayfaBas == null || g.sayfaSon == null || g.sayfaBas <= g.sayfaSon, { message: 'Sayfa aralığı ters (bitiş başlangıçtan küçük)', path: ['sayfaSon'] })

export const icerikSchema = z.object({
  surum: z.literal(2).optional(),
  ekranSuresi: z.number().min(0).max(24).nullable().optional(),
  duzen: metin(300),
  gizliOdevler: z.array(UUID).max(200).optional(),
  gorevler: z.array(gorevSchema).max(120),
  mentorOdevleri: z.array(z.object({
    id: z.string().min(1).max(64), kitapId: UUID.nullable(), kitapAdi: metin(120).min(1), konu: metin(120), sayfalar: metin(60), yapti: z.boolean(),
  })).max(40),
  okuma: z.object({ kitap: metin(150).min(1), sayfa: sayi.nullable(), bitti: z.boolean() }).nullable(),
  sonuclar: z.array(z.object({
    anahtar: z.string().min(3).max(200), ad: metin(150), ders: metin(60), sayfa: metin(60),
    cozulen: sayi.nullable(), dogru: sayi.nullable(), yanlis: sayi.nullable(), bos: sayi.nullable(),
    planSon: z.number().int().min(1).max(5000).nullable().optional(), kaldigi: z.number().int().min(1).max(5000).nullable().optional(),
  }).refine(s => s.dogru === null || (s.cozulen !== null && s.dogru <= s.cozulen), {
    message: 'Doğru sayısı çözülen soru sayısından büyük olamaz', path: ['dogru'],
  })).max(60).optional(),
})

export const gorusmeSchema = z.object({ not: metin(2000), rica: metin(1000), veliMesaji: metin(2000).nullable() })

export const kaydetSchema = z.object({
  studentId: UUID,
  hafta: z.string().refine(pazartesiMi, 'Hafta pazartesi olmalı'),
  seviye: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  soruHedefi: z.number().int().min(0).max(10_000),
  icerik: icerikSchema,
  gorusme: gorusmeSchema,
  sonBilinen: z.string().datetime({ offset: true }).nullable(),
})
export type KaydetGirdisi = z.infer<typeof kaydetSchema>
