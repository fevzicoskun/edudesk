import { z } from 'zod'
import { UUID } from '@/src/shared/validation'

/** Bireysel ödev (spec 2026-10-24): öğretmenin tek öğrenciye verdiği ekstra ödev. Saf kurallar. */
export type BireyselOdev = {
  id: string; ogrenciId: string; ogrenciAd: string; sinifId: string; sinifAd: string
  aciklama: string; teslimTarihi: string | null; yapildi: boolean; yapildiTarihi: string | null; olusturmaTarihi: string
}
export type Filtre = 'bekleyen' | 'tumu'

/** Teslimi geçmiş (bugün teslim olan değil) ve yapılmamış. */
export const gecikmisMi = (o: Pick<BireyselOdev, 'yapildi' | 'teslimTarihi'>, bugun: string) =>
  !o.yapildi && o.teslimTarihi !== null && o.teslimTarihi < bugun

/** Gecikmişler üstte (en eski teslim önce) → bekleyenler teslime göre (tarihsizler sonda, yeniden eskiye) → yapılanlar (son yapılan önce). */
export function listeSirala(liste: BireyselOdev[], bugun: string): BireyselOdev[] {
  const grup = (o: BireyselOdev) => (gecikmisMi(o, bugun) ? 0 : o.yapildi ? 2 : 1)
  return [...liste].sort((a, b) => {
    const g = grup(a) - grup(b)
    if (g !== 0) return g
    if (grup(a) === 2) return (b.yapildiTarihi ?? '').localeCompare(a.yapildiTarihi ?? '')
    if (a.teslimTarihi !== b.teslimTarihi) {
      if (a.teslimTarihi === null) return 1
      if (b.teslimTarihi === null) return -1
      return a.teslimTarihi.localeCompare(b.teslimTarihi)
    }
    return b.olusturmaTarihi.localeCompare(a.olusturmaTarihi)
  })
}

export const filtrele = (liste: BireyselOdev[], filtre: Filtre) => (filtre === 'tumu' ? liste : liste.filter(o => !o.yapildi))

const aciklama = z.string().trim().min(1, 'Açıklama boş olamaz').max(300, 'Açıklama en çok 300 karakter')
// Form boş tarih "" gönderir → null (isteğe bağlı)
const teslimTarihi = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih')]).transform(t => (t === '' ? null : t))

export const ekleSema = z.object({ ogrenciId: UUID, aciklama, teslimTarihi })
export const duzenleSema = z.object({ id: UUID, aciklama, teslimTarihi })
