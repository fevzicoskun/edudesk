import { oran } from './analitik'
import type { SubmissionStatus } from '@/src/shared/types'

export type OdevIlerleme = { yapildi: number; payda: number; isaretli: number; yuzde: number | null; girilmedi: number }

/** Bir ödevin "kaç kişi yaptı" özeti — her ekranda aynı hesap. sayim yalnız İŞARETLİ (marked_at dolu) satırlar.
 *  Yüzde analitikle aynı tanım (oran): yapıldı / (işaretli − mazeretli); işaretlenmemiş öğrenci paydaya girmez.
 *  mevcut: sınıf mevcudu (0 = bilinmiyor → girilmedi 0). */
export function odevIlerleme(sayim: Partial<Record<SubmissionStatus, number>>, mevcut: number): OdevIlerleme {
  const isaretli  = Object.values(sayim).reduce((a, b) => a + (b ?? 0), 0)
  const yapildi   = sayim.yapildi ?? 0
  const mazeretli = sayim.mazeretli ?? 0
  return { yapildi, payda: isaretli - mazeretli, isaretli, yuzde: oran(yapildi, isaretli, mazeretli), girilmedi: Math.max(0, mevcut - isaretli) }
}

/** "· 4 girilmedi" — işaretlenmemiş öğrenci yoksa boş. */
export const girilmediMetni = (n: number) => (n > 0 ? ` · ${n} girilmedi` : '')

/** "%27 · 3/11 yaptı · 4 girilmedi"; değerlendirilen öğrenci yoksa null (ekran "Henüz kontrol edilmedi" der). */
export function ilerlemeMetni(i: OdevIlerleme): string | null {
  if (i.yuzde === null) return null
  return `%${i.yuzde} · ${i.yapildi}/${i.payda} yaptı${girilmediMetni(i.girilmedi)}`
}
