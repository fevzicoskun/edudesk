import { ozetHesapla, programYuzde, type Icerik } from '../takip/takipMath'
import type { DenemeTuru, DersSonucu } from '../deneme/stoys'
// Durum etiketi sonuç kâğıdıyla AYNI hesap olmalı (spec): oradaki tanımlar yeniden kullanılır
import { durumOf, durumYuzdesi, soruGirildi, type Durum } from '@/app/(dashboard)/mentorluk/[studentId]/takip/SonucKagidi'

/** Veli toplantısı kâğıdı hesapları (spec 2026-10-22). Saf. */

export type DenemeSatiri = { tarih: string; katilmadi: boolean; dersler: DersSonucu[]; toplamNet: number | null; degisim: number | null }

/** Tür başına gidiş, eskiden yeniye. Yalnız öğrencinin sınıfı için yüklenmiş sınavlar; satırı yoksa "katılmadı" (0 DEĞİL).
 *  Değişim: katıldığı bir önceki aynı tür sınava göre (ilk ya da katılmadı → null). */
export function denemeGidisi(
  sinavlar: { id: string; tur: DenemeTuru; tarih: string; siniflar: string[] }[],
  sonuclar: { sinavId: string; dersler: DersSonucu[]; toplamNet: number }[],
  ogrenciSinifId: string,
): Record<DenemeTuru, DenemeSatiri[]> {
  const sonuc = new Map(sonuclar.map(s => [s.sinavId, s]))
  const gidis: Record<DenemeTuru, DenemeSatiri[]> = { TM: [], FKB: [], TCD: [] }
  for (const s of [...sinavlar].filter(x => x.siniflar.includes(ogrenciSinifId)).sort((a, b) => a.tarih.localeCompare(b.tarih))) {
    const r = sonuc.get(s.id)
    const onceki = [...gidis[s.tur]].reverse().find(x => !x.katilmadi)
    gidis[s.tur].push(r
      ? { tarih: s.tarih, katilmadi: false, dersler: r.dersler, toplamNet: r.toplamNet,
          degisim: onceki?.toplamNet != null ? Math.round((r.toplamNet - onceki.toplamNet) * 100) / 100 : null }
      : { tarih: s.tarih, katilmadi: true, dersler: [], toplamNet: null, degisim: null })
  }
  return gidis
}

export type HaftaSatiri = { hafta: string; girilmedi: boolean; program: number | null; soru: number | null; hedef: number; durum: Durum | null }

/** Haftalık plan özeti tek satır — SonucKagidi ile aynı tanımlar (hicVeri, soruGirildi, durumYuzdesi). */
export function haftaSatiri(haftaBasi: string, icerik: Icerik, soruHedefi: number): HaftaSatiri {
  const o = ozetHesapla(icerik)
  const sg = soruGirildi(icerik)
  const girilmedi = o.gorev_yapilan === 0 && !sg
  if (girilmedi) return { hafta: haftaBasi, girilmedi, program: null, soru: null, hedef: soruHedefi, durum: null }
  const program = programYuzde(o), soru = sg ? o.soru : null
  const y = durumYuzdesi(program, soru, soruHedefi)
  return { hafta: haftaBasi, girilmedi, program, soru, hedef: soruHedefi, durum: y === null ? null : durumOf(y) }
}
