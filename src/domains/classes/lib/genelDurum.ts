/** Öğrenci sayfası "Genel Durum" rozeti.
 *  Ödev oranı ancak MIN_DEGERLENDIRILEN kontrol edilmiş ödevden sonra hüküm sayılır — 1-2 ödevle
 *  "Risk" damgası gürültüdür (2026-09-28 canlı ölçüm: ödevli 47 öğrencinin hepsi 1-2 ödevdeydi). */
export const MIN_DEGERLENDIRILEN = 5

export type GenelDurum = 'risk' | 'dikkat' | 'iyi' | 'az'

export function genelDurum(g: {
  /** kontrol edilmiş, mazeretli olmayan ödev sayısı */
  degerlendirilen: number
  /** tamamlama yüzdesi 0-100 (computeStudentHomeworkStats.completionRate) */
  oran: number
  devamsizlikUyari: boolean
  devamsizlikSinir: boolean
}): GenelDurum {
  if (g.devamsizlikSinir) return 'risk'
  const odev = odevSeviyesi(g.degerlendirilen, g.oran)
  if (odev === 'az') return g.devamsizlikUyari ? 'dikkat' : 'az'
  if (odev === 'risk') return 'risk'
  if (g.devamsizlikUyari) return 'dikkat'
  return odev
}

/** Yalnız ödev tarafının seviyesi — rozet ve "Ödev Tamamlanma" çubuğunun rengi aynı eşiklerden türer. */
export function odevSeviyesi(degerlendirilen: number, oran: number): GenelDurum {
  if (degerlendirilen < MIN_DEGERLENDIRILEN) return 'az'
  if (oran < 40) return 'risk'
  if (oran < 60) return 'dikkat'
  return 'iyi'
}
