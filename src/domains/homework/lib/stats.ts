import type { SubmissionStatus } from '@/src/shared/types'

export type HomeworkRecord = {
  id: string
  title: string
  subject: string
  due_date: string
  status: SubmissionStatus
  note: string | null
}

export type StudentHomeworkStats = {
  total: number
  yapildi: number
  eksik: number
  yapilmadi: number
  gec: number
  mazeretli: number
  completionRate: number
}

export function computeStudentHomeworkStats(homeworks: HomeworkRecord[]): StudentHomeworkStats {
  const counts = { yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0 }
  for (const hw of homeworks) {
    counts[hw.status]++
  }
  const eligible = homeworks.length - counts.mazeretli
  const completionRate = eligible === 0 ? 0 : Math.round((counts.yapildi / eligible) * 100)
  return { total: homeworks.length, ...counts, completionRate }
}
