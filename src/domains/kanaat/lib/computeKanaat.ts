import type { KanaatInput } from '../types'

const GENEL_DEGERLENDIRME: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: 'Dönem boyunca üstün başarı göstermiştir.',
  4: 'Dönem boyunca başarılı bir performans sergilemiştir.',
  3: 'Dönem boyunca orta düzeyde bir performans göstermiştir.',
  2: 'Dönem boyunca gelişime açık bir performans göstermiştir.',
  1: 'Dönem boyunca destek gerektiren bir süreç geçirmiştir.',
}

function clamp15(val: number): number {
  return Math.max(1, Math.min(5, val))
}

/**
 * Computes a kanaat (teacher evaluation) score from student performance metrics.
 * @param input.homeworkDone should be <= homeworkTotal
 * @param input.examAverage 0-100 or null; values outside range are clamped
 * @param input.absenceDays non-negative integer
 * @returns A score between 1 and 5
 */
export function computeKanaat(input: KanaatInput): 1 | 2 | 3 | 4 | 5 {
  const { homeworkTotal, homeworkDone, absenceDays, examAverage } = input

  type Source = { score: number; weight: number }
  const sources: Source[] = []

  // Ödev bileşeni (ağırlık 0.4)
  if (homeworkTotal > 0) {
    const ratio = homeworkDone / homeworkTotal
    sources.push({ score: clamp15(ratio * 4 + 1), weight: 0.4 })
  }

  // Devamsızlık bileşeni (ağırlık 0.3)
  {
    const devScore = clamp15((Math.max(0, 20 - absenceDays) / 20) * 4 + 1)
    sources.push({ score: devScore, weight: 0.3 })
  }

  // Sınav bileşeni (ağırlık 0.3)
  if (examAverage !== null) {
    sources.push({ score: clamp15((examAverage / 100) * 4 + 1), weight: 0.3 })
  }

  // Ağırlıkları normalize et (toplam 1 olsun)
  const totalWeight = sources.reduce((s, x) => s + x.weight, 0)
  const weighted = sources.reduce((s, x) => s + (x.score * x.weight) / totalWeight, 0)

  return Math.round(weighted) as 1 | 2 | 3 | 4 | 5
}

export function generateKanaatText(
  studentName: string,
  score:       1 | 2 | 3 | 4 | 5,
  stats: {
    homeworkPct: number       // 0-100
    absenceDays: number
    examAverage: number | null
  },
): string {
  const { homeworkPct, absenceDays, examAverage } = stats
  const pct   = Math.round(homeworkPct)
  const genel = GENEL_DEGERLENDIRME[score]

  const odevSatir = `ödevlerini %${pct} oranında tamamlamıştır`
  const devSatir  = `${absenceDays} gün devamsızlık yapmıştır`
  const sinavSatir = examAverage !== null
    ? ` Sınav ortalaması ${Math.round(examAverage)} puandır.`
    : ''

  return `${studentName} bu dönem ${odevSatir}. ${devSatir}.${sinavSatir} ${genel}`
}
