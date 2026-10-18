// Ödev formunda öğretmenin seçebileceği dersler (serbest metin yerine).
// Atamalarda (teacher_classes) ders bilgisi yok; ders + sınıf yalnız ders programında (lesson_schedules.slots) var.
// Kaynak sırası: ders programı → profil branşı → okulun tüm dersleri.
import type { Slot } from '@/src/domains/schedule/scheduleMath'

const tr = (a: string, b: string) => a.localeCompare(b, 'tr')
const kucuk = (s: string) => s.trim().toLocaleLowerCase('tr')

// ponytail: tek okul (Bahçeşehir) listesi kodda; ikinci okul farklı ders listesi isterse okul bazlı tabloya taşınır.
export const OKUL_DERSLERI: string[] = [
  'Almanca', 'Beden Eğitimi ve Spor', 'Biyoloji', 'Coğrafya', 'Din Kültürü ve Ahlak Bilgisi', 'Felsefe', 'Fizik',
  'Geometri', 'İngilizce', 'Kimya', 'Matematik', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Tarih',
  'Türk Dili ve Edebiyatı', 'Yapay Zeka',
].sort(tr)

// Ders programındaki (PDF'ten gelen) kısa/eski adlar → okul ders adı. null = ders değil.
const PROGRAM_ESLEME: Record<string, string | null> = {
  'türkçe': 'Türk Dili ve Edebiyatı',
  'din kültürü': 'Din Kültürü ve Ahlak Bilgisi',
  'beden eğitimi': 'Beden Eğitimi ve Spor',
  'inkılap tarihi': 'T.C. İnkılap Tarihi ve Atatürkçülük',
  's-mat': 'Matematik',
  's-fiz': 'Fizik',
  's-kim': 'Kimya',
  's-coğ': 'Coğrafya',
  's-tar': 'Tarih',
  's-tdve': 'Türk Dili ve Edebiyatı',
  'mentörlük': null,
}

/** Ders programı adını okul ders adına çevirir; ders değilse ya da tanınmıyorsa null. */
export function programDersi(ad: string): string | null {
  const k = kucuk(ad)
  if (!k) return null
  for (const aday of [k, k.replace(/\s+\d+$/, '')]) { // "Matematik 2" → "matematik"
    if (aday in PROGRAM_ESLEME) return PROGRAM_ESLEME[aday]
    const okul = OKUL_DERSLERI.find(d => kucuk(d) === aday)
    if (okul) return okul
  }
  return null
}

/** Profil branşından dersler. Matematik branşı geometriyi de okutur (program yoksa ikisi birlikte sunulur). */
export function bransDersleri(brans: string | null | undefined): string[] {
  const ders = brans ? programDersi(brans) : null
  if (!ders) return []
  return ders === 'Matematik' ? ['Matematik', 'Geometri'] : [ders]
}

export type DersSecenekleri = {
  dersler: string[]
  /** sınıf id → o sınıfta verdiği dersler (yalnız programdan; branş/okul kaynağında boş) */
  sinifDersleri: Record<string, string[]>
  kaynak: 'program' | 'brans' | 'okul'
}

export function ogretmenDersleri(slots: Slot[], brans: string | null | undefined): DersSecenekleri {
  const sinif = new Map<string, Set<string>>()
  for (const sl of slots) {
    const ders = sl.subject ? programDersi(sl.subject) : null
    if (!ders || !sl.class_id) continue
    sinif.set(sl.class_id, (sinif.get(sl.class_id) ?? new Set()).add(ders))
  }
  if (sinif.size) {
    const sinifDersleri = Object.fromEntries([...sinif].map(([id, d]) => [id, [...d].sort(tr)]))
    return { dersler: [...new Set(Object.values(sinifDersleri).flat())].sort(tr), sinifDersleri, kaynak: 'program' }
  }
  const b = bransDersleri(brans)
  if (b.length) return { dersler: b, sinifDersleri: {}, kaynak: 'brans' }
  return { dersler: OKUL_DERSLERI, sinifDersleri: {}, kaynak: 'okul' }
}

/** Formda önceden seçili ders: tek ders → o; seçilen sınıfta tek ders veriyorsa → o; yoksa seçim yok. */
export function varsayilanDers(sec: DersSecenekleri, sinifId: string | null): string {
  if (sec.dersler.length === 1) return sec.dersler[0]
  const sinifta = sinifId ? sec.sinifDersleri[sinifId] : undefined
  return sinifta?.length === 1 ? sinifta[0] : ''
}
