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
