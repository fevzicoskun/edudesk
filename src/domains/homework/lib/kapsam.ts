/** Kim hangi ödevleri görür (2026-09-24 kararı):
 *  müdür/MY → hepsi · zümre başkanı → kendi branşındaki öğretmenler · öğretmen → yalnız kendisi.
 *  Zümre = aynı profiles.subject (büyük/küçük harf ve boşluk farkı yok sayılır). */
export type OdevKapsami = { tumu: true } | { tumu: false; ogretmenIds: string[] }

type Kisi = { id: string; subject: string | null }

const norm = (s: string | null) => (s ?? '').trim().toLocaleLowerCase('tr-TR')

export function odevKapsami(ben: Kisi & { role: string }, okulOgretmenleri: Kisi[]): OdevKapsami {
  if (ben.role === 'mudur' || ben.role === 'mudur_yardimcisi') return { tumu: true }
  const brans = norm(ben.subject)
  if (ben.role !== 'zumre_baskani' || !brans) return { tumu: false, ogretmenIds: [ben.id] }
  const ids = new Set([ben.id, ...okulOgretmenleri.filter(o => norm(o.subject) === brans).map(o => o.id)])
  return { tumu: false, ogretmenIds: [...ids] }
}

/** Kapsam içindeki bir ödevin sahibi mi? (detay sayfası erişim kontrolü) */
export const kapsamdaMi = (k: OdevKapsami, teacherId: string) => k.tumu || k.ogretmenIds.includes(teacherId)
