import { PENDING_REVIEW_DAYS } from '@/src/shared/constants/limits'

export type OdevKategori = 'aktif' | 'kontrolBekliyor' | 'gecmis'

export interface KategoriGirdi {
  dueDate: string | null   // 'YYYY-MM-DD'
  /** marked_at'i dolu submission sayısı — "satır var" değil, "öğretmen işaretledi". */
  isaretliSayisi: number
  /** Sınıf mevcudu; 0 = bilinmiyor. */
  ogrenciSayisi: number
}

/** Verilen anın Türkiye yerel tarihi (YYYY-MM-DD). todayLocalISO ile aynı desen, ama deterministik. */
function istanbulGunu(an: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(an)
}

/**
 * Ödevi listedeki bölümüne ayırır.
 *
 * homework_submissions satırları ödevle birlikte otomatik yaratılır, bu yüzden satır
 * sayısı ilerlemeyi ölçmez — yalnız marked_at ölçer (2026-09-19 bulgusu: satır sayısına
 * bakan iki uyarı da hiç tetiklenmemişti).
 */
export function kategorizeOdev(g: KategoriGirdi, bugun: Date): OdevKategori {
  if (!g.dueDate) return 'aktif'

  const bugunISO = istanbulGunu(bugun)
  if (g.dueDate >= bugunISO) return 'aktif'   // teslim günü gün sonuna kadar aktif

  const yariEsik = g.ogrenciSayisi > 0 ? Math.ceil(g.ogrenciSayisi / 2) : 1
  if (g.isaretliSayisi >= yariEsik) return 'gecmis'

  const gecenGun = Math.floor((Date.parse(bugunISO) - Date.parse(g.dueDate)) / 86_400_000)
  return gecenGun <= PENDING_REVIEW_DAYS ? 'kontrolBekliyor' : 'gecmis'
}

/**
 * Öğretmen bu ödevde hiç işaretleme yapmamış mı?
 * Satırların varlığı bir şey söylemez (otomatik yaratılırlar) — yalnız marked_at söyler.
 */
export function hicIsaretlenmedi(submissions: { marked_at: string | null }[]): boolean {
  return submissions.every(s => !s.marked_at)
}

/** Kaynak adlarını karşılaştırır. Türkçe kıyas şart: 'İLKE'.toLowerCase() → 'i̇lke' (bozuk). */
export function ayniKaynak(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('tr') === b.trim().toLocaleLowerCase('tr')
}

/**
 * Öğretmenin gerçek dili "hangi kitaptan hangi sayfalar" — başlığı ondan kurar.
 * (Canlı veride başlıklar zaten "Başarıyorum sayfa 39-47" biçimindeydi.)
 */
export function onerilenBaslik(kaynak: string, sayfa: string): string {
  const k = kaynak.trim()
  const s = sayfa.trim()
  if (k && s) return `${k} · s.${s}`
  if (k) return k
  if (s) return `s.${s}`
  return ''
}
