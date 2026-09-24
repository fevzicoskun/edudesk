import type { SubmissionStatus } from '@/src/shared/types'

export type HomeworkRecord = {
  id: string
  title: string
  subject: string
  due_date: string | null
  /** null = öğretmen henüz işaretlemedi (kontrol edilmedi) */
  status: SubmissionStatus | null
  note: string | null
}

export type StudentHomeworkStats = {
  total: number
  yapildi: number
  eksik: number
  yapilmadi: number
  gec: number
  mazeretli: number
  kontrolEdilmedi: number
  completionRate: number
}

export function computeStudentHomeworkStats(homeworks: HomeworkRecord[]): StudentHomeworkStats {
  const counts = { yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0, kontrolEdilmedi: 0 }
  for (const hw of homeworks) {
    counts[hw.status ?? 'kontrolEdilmedi']++
  }
  const eligible = homeworks.length - counts.mazeretli - counts.kontrolEdilmedi
  const completionRate = eligible === 0 ? 0 : Math.round((counts.yapildi / eligible) * 100)
  return { total: homeworks.length, ...counts, completionRate }
}

type OdevSatiri = { id: string; title: string; subject: string; due_date: string | null }
type TeslimSatiri = { homework_id: string; student_id: string; status: string; note: string | null }

/** Sınıfın ödevlerini + işaretli teslimleri öğrenci başına HomeworkRecord listesine çevirir.
 *  Teslimi olmayan ödev status=null ("kontrol edilmedi") — "yapılmadı" DEĞİL. */
export function sinifOdevKayitlari(
  ogrenciIds: string[],
  odevler: OdevSatiri[],
  teslimler: TeslimSatiri[],
): Map<string, HomeworkRecord[]> {
  const teslim = new Map(teslimler.map(t => [`${t.student_id}:${t.homework_id}`, t]))
  return new Map(ogrenciIds.map(sid => [sid, odevler.map(hw => {
    const t = teslim.get(`${sid}:${hw.id}`)
    return {
      id: hw.id, title: hw.title, subject: hw.subject, due_date: hw.due_date,
      status: (t?.status ?? null) as SubmissionStatus | null,
      note: t?.note ?? null,
    }
  })]))
}
