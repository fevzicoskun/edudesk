import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { pazartesiMi } from '../lib/bultenMath'

const metin = (n: number) => z.string().trim().max(n)
const sayi = z.number().int().min(0).max(100_000)

const gorevSchema = z.object({
  id: z.string().min(1).max(64), gun: z.number().int().min(0).max(6), ad: metin(120).min(1, 'Görev adı boş olamaz'),
  ders: metin(60).nullable(), miktar: z.number().int().min(1).max(600).nullable(), birim: z.enum(['dk', 'soru', 'serbest']),
  soruSatiri: z.boolean(), konu: metin(120), sayfa: metin(60), yapti: z.boolean(), soru: sayi.nullable(), dogru: sayi.nullable(),
}).refine(g => g.dogru === null || (g.soru !== null && g.dogru <= g.soru), { message: 'Doğru sayısı soru sayısından büyük olamaz', path: ['dogru'] })

export const icerikSchema = z.object({
  duzen: metin(300),
  gorevler: z.array(gorevSchema).max(120),
  mentorOdevleri: z.array(z.object({
    id: z.string().min(1).max(64), kitapId: UUID.nullable(), kitapAdi: metin(120).min(1), konu: metin(120), sayfalar: metin(60), yapti: z.boolean(),
  })).max(40),
  okuma: z.object({ kitap: metin(150).min(1), sayfa: sayi.nullable(), bitti: z.boolean() }).nullable(),
})

export const gorusmeSchema = z.object({ iyi: metin(1000), zor: metin(1000), hedef: metin(300), odak: metin(1000), evde: metin(1000) })

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
