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

/** Raporun başına konan "kim yapmadı" listesi — çıktının en çok bakılan bilgisi.
 *  İşaretlenmemiş öğrenci (durumKodu null) listeye GİRMEZ: bilgi yokken suçlama olmaz. */
export function yapmayanlar(satirlar: RaporSatiri[]): string[] {
  return satirlar
    .filter(s => s.durumKodu === 'yapilmadi' || s.durumKodu === 'eksik')
    .map(s => s.numara ? `${s.ad} (${s.numara})` : s.ad)
}
