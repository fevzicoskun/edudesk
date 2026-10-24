import { oran } from './analitik'
import type { SubmissionStatus } from '@/src/shared/types'

export type OdevIlerleme = {
  yapildi: number; payda: number; isaretli: number; yuzde: number | null; girilmedi: number
  sayim: Record<SubmissionStatus, number>
}

/** Bir ödevin "kaç kişi yaptı" özeti — her ekranda aynı hesap. sayim yalnız İŞARETLİ (marked_at dolu) satırlar.
 *  Yüzde analitikle aynı tanım (oran): yapıldı / (işaretli − mazeretli); işaretlenmemiş öğrenci paydaya girmez.
 *  mevcut: sınıf mevcudu (0 = bilinmiyor → girilmedi 0). */
export function odevIlerleme(s: Partial<Record<SubmissionStatus, number>>, mevcut: number): OdevIlerleme {
  const sayim = { yapildi: s.yapildi ?? 0, eksik: s.eksik ?? 0, gec: s.gec ?? 0, yapilmadi: s.yapilmadi ?? 0, mazeretli: s.mazeretli ?? 0 }
  const isaretli = Object.values(sayim).reduce((a, b) => a + b, 0)
  return {
    yapildi: sayim.yapildi, payda: isaretli - sayim.mazeretli, isaretli, sayim,
    yuzde: oran(sayim.yapildi, isaretli, sayim.mazeretli),
    girilmedi: Math.max(0, mevcut - isaretli),
  }
}

export type DurumParcasi = { kod: SubmissionStatus | 'girilmedi'; n: number; metin: string }

/** Ödevin öğrencileri durumlara bölünmüş halde; 0 olanlar yok. Toplamı = sınıf mevcudu (2026-10-24: eksik ve
 *  mazeretli metinde yazmadığı için "8/18" gibi sayılar mevcutla tutmuyordu). */
export function durumParcalari(i: OdevIlerleme): DurumParcasi[] {
  const p: DurumParcasi[] = [
    { kod: 'yapildi', n: i.sayim.yapildi, metin: `${i.sayim.yapildi} yaptı` },
    { kod: 'eksik', n: i.sayim.eksik, metin: `${i.sayim.eksik} eksik` },
    { kod: 'gec', n: i.sayim.gec, metin: `${i.sayim.gec} geç` },
    { kod: 'yapilmadi', n: i.sayim.yapilmadi, metin: `${i.sayim.yapilmadi} yapmadı` },
    { kod: 'mazeretli', n: i.sayim.mazeretli, metin: `${i.sayim.mazeretli} mazeretli` },
    { kod: 'girilmedi', n: i.girilmedi, metin: `${i.girilmedi} girilmedi` },
  ]
  return p.filter(x => x.n > 0)
}

/** "%38 · 9 yaptı · 4 eksik · 11 yapmadı · 2 girilmedi"; değerlendirilen öğrenci yoksa null (ekran "Henüz kontrol edilmedi" der). */
export function ilerlemeMetni(i: OdevIlerleme): string | null {
  if (i.yuzde === null) return null
  return [`%${i.yuzde}`, ...durumParcalari(i).map(p => p.metin)].join(' · ')
}
