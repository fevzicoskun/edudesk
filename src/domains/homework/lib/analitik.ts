import { startOfWeek, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'

export type AnalitikHomework = {
  id: string
  class_id: string
  teacher_id: string
  due_date: string | null
  title: string
}

export type AnalitikSubmission = {
  homework_id: string
  student_id: string
  status: SubmissionStatus
}

export type AnalitikStudent = {
  id: string
  class_id: string
  full_name: string
  student_number: string | null
}

export type ClassStat = {
  classId: string
  completionPct: number
  totalHomeworks: number
  studentCount: number
  pendingReview: number
}

export type RiskyStudent = {
  student_id: string
  full_name: string
  student_number: string | null
  class_id: string
  missedCount: number
  totalHomeworks: number
}

export type WeekBucket = {
  weekKey: string
  pct: number
}

export type KpiCards = {
  totalHomeworks: number
  avgCompletionPct: number
  riskyStudentCount: number
  pendingReviewCount: number
}

export function computeClassStats(
  classId: string,
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  studentCount: number,
): ClassStat {
  const classHws   = homeworks.filter(h => h.class_id === classId)
  const classHwIds = new Set(classHws.map(h => h.id))
  const classSubs  = submissions.filter(s => classHwIds.has(s.homework_id))

  const totalSlots = classHws.length * studentCount
  const yapildi    = classSubs.filter(s => s.status === 'yapildi').length
  const mazeretli  = classSubs.filter(s => s.status === 'mazeretli').length
  const eligible   = totalSlots - mazeretli
  const completionPct = eligible === 0 ? 0 : Math.round((yapildi / eligible) * 100)

  const today        = new Date().toISOString().slice(0, 10)
  const hwsWithSubs  = new Set(classSubs.map(s => s.homework_id))
  const pendingReview = classHws.filter(
    h => h.due_date !== null && h.due_date < today && !hwsWithSubs.has(h.id),
  ).length

  return { classId, completionPct, totalHomeworks: classHws.length, studentCount, pendingReview }
}

export function computeRiskyStudents(
  students: AnalitikStudent[],
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
): RiskyStudent[] {
  return students
    .map(s => {
      const classHwIds   = new Set(homeworks.filter(h => h.class_id === s.class_id).map(h => h.id))
      const totalHomeworks = classHwIds.size
      const missed        = submissions.filter(
        sub => sub.student_id === s.id && classHwIds.has(sub.homework_id) &&
               (sub.status === 'yapilmadi' || sub.status === 'eksik'),
      ).length
      return { student_id: s.id, full_name: s.full_name, student_number: s.student_number, class_id: s.class_id, missedCount: missed, totalHomeworks }
    })
    .filter(s => s.missedCount >= 3)
    .sort((a, b) => b.missedCount - a.missedCount)
}

export function computeWeeklyTrend(
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  students: AnalitikStudent[],
): WeekBucket[] {
  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  const weekMap = new Map<string, AnalitikHomework[]>()
  for (const hw of homeworks) {
    if (!hw.due_date) continue
    const weekKey = startOfWeek(parseISO(hw.due_date), { weekStartsOn: 1 }).toISOString().slice(0, 10)
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, [])
    weekMap.get(weekKey)!.push(hw)
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([weekKey, weekHws]) => {
      const hwIds    = new Set(weekHws.map(h => h.id))
      const weekSubs = submissions.filter(s => hwIds.has(s.homework_id))

      let totalSlots = 0
      let yapildi    = 0
      let mazeretli  = 0
      for (const hw of weekHws) totalSlots += studentsByClass.get(hw.class_id) ?? 0
      for (const s of weekSubs) {
        if (s.status === 'yapildi')        yapildi++
        else if (s.status === 'mazeretli') mazeretli++
      }

      const eligible = totalSlots - mazeretli
      return { weekKey, pct: eligible === 0 ? 0 : Math.round((yapildi / eligible) * 100) }
    })
}

export function computeKpiCards(
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  students: AnalitikStudent[],
): KpiCards {
  const totalHomeworks = homeworks.length

  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  let completionSum = 0
  let counted       = 0
  for (const hw of homeworks) {
    const count = studentsByClass.get(hw.class_id) ?? 0
    if (count === 0) continue
    const hwSubs    = submissions.filter(s => s.homework_id === hw.id)
    const yapildi   = hwSubs.filter(s => s.status === 'yapildi').length
    const mazeretli = hwSubs.filter(s => s.status === 'mazeretli').length
    const eligible  = count - mazeretli
    if (eligible > 0) { completionSum += Math.round((yapildi / eligible) * 100); counted++ }
  }
  const avgCompletionPct = counted === 0 ? 0 : Math.round(completionSum / counted)

  const riskyStudentCount  = computeRiskyStudents(students, homeworks, submissions).length
  const today              = new Date().toISOString().slice(0, 10)
  const hwsWithAnySub      = new Set(submissions.map(s => s.homework_id))
  const pendingReviewCount = homeworks.filter(
    h => h.due_date !== null && h.due_date < today && !hwsWithAnySub.has(h.id),
  ).length

  return { totalHomeworks, avgCompletionPct, riskyStudentCount, pendingReviewCount }
}
