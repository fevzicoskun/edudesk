import type { SubmissionStatus } from '@/src/shared/types'

/** Rapor/çıktı sırası: olumludan olumsuza */
const RAPOR_SIRASI: SubmissionStatus[] = ['yapildi', 'gec', 'eksik', 'yapilmadi', 'mazeretli']

const ETIKET: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç', mazeretli: 'Mazeretli',
}

export type RaporSatiri = {
  sira: number
  numara: string
  ad: string
  durum: string
  /** Henüz işaretlenmemiş öğrencide null — renk/vurgu uygulanmaz */
  durumKodu: SubmissionStatus | null
  not: string
}

type SatirGirdisi = {
  items: { student_id: string; full_name: string; student_number: string | null }[]
  statuses: Record<string, SubmissionStatus>
  notes: Record<string, string>
  /** Gerçekten kaydedilmiş öğrenciler; dışındakiler "—" basılır */
  recordedIds: Set<string>
}

export function raporSatirlari({ items, statuses, notes, recordedIds }: SatirGirdisi): RaporSatiri[] {
  return items.map((item, i) => {
    const islendi = recordedIds.has(item.student_id)
    const kod     = islendi ? statuses[item.student_id] ?? null : null
    return {
      sira:      i + 1,
      numara:    item.student_number ?? '',
      ad:        item.full_name,
      durum:     kod ? ETIKET[kod] : '—',
      durumKodu: kod,
      not:       notes[item.student_id] ?? '',
    }
  })
}

export type OzetKalemi = {
  etiket: string
  sayi: number
  /** null = "Girilmedi" — gerçek bir durum değil, kayıt yokluğu */
  kod: SubmissionStatus | null
}

/** Sıfır olan durumları atlar; işaretlenmemiş öğrencileri ayrı "Girilmedi" kalemi yapar */
export function raporOzeti(
  statuses: Record<string, SubmissionStatus>,
  recordedIds: Set<string>,
  toplamOgrenci: number,
): OzetKalemi[] {
  const sayimlar = RAPOR_SIRASI.map(kod => ({
    etiket: ETIKET[kod],
    sayi:   Object.entries(statuses).filter(([id, s]) => s === kod && recordedIds.has(id)).length,
    kod,
  })).filter(k => k.sayi > 0)

  const girilmedi = Math.max(0, toplamOgrenci - recordedIds.size)
  return girilmedi > 0 ? [...sayimlar, { etiket: 'Girilmedi', sayi: girilmedi, kod: null }] : sayimlar
}

/** Raporun başına konan isim listeleri — çıktının en çok bakılan bilgisi.
 *  "Yapmayanlar" ve "Eksik bırakanlar" AYRI listelenir: tek listede toplanınca
 *  özetteki sayılarla ("10 Yapılmadı" ama "Yapmayanlar (11)") tutmuyordu.
 *  İşaretlenmemiş öğrenci (durumKodu null) hiçbir listeye GİRMEZ: bilgi yokken suçlama olmaz. */
export function durumListesi(satirlar: RaporSatiri[], kodlar: SubmissionStatus[]): string[] {
  return satirlar
    .filter(s => s.durumKodu !== null && kodlar.includes(s.durumKodu))
    .map(s => s.ad) // numara basılmaz: kağıtta yalnız ad yeter (kullanıcı kararı 2026-09-26)
}

/** Raporun tek A4 sayfaya sığması için satırları sütunlara böler (sütun sütun, numara sırası korunur).
 *  ponytail: eşikler 10.5pt satır yüksekliği + başlık bloğu için ölçüldü; font değişirse yeniden ayarla. */
export function sutunlaraBol<T>(satirlar: T[]): T[][] {
  const sutun = satirlar.length <= 22 ? 1 : satirlar.length <= 46 ? 2 : 3
  const boy = Math.ceil(satirlar.length / sutun)
  if (boy === 0) return [[]]
  return Array.from({ length: sutun }, (_, i) => satirlar.slice(i * boy, (i + 1) * boy)).filter(s => s.length > 0)
}
