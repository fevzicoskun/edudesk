import { startOfWeek, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'

function todayTR(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

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

  const today = todayTR()
  const subCountByHw = new Map<string, number>()
  for (const s of classSubs) {
    subCountByHw.set(s.homework_id, (subCountByHw.get(s.homework_id) ?? 0) + 1)
  }
  const pendingReview = classHws.filter(
    h => h.due_date !== null && h.due_date < today && (subCountByHw.get(h.id) ?? 0) < studentCount,
  ).length

  return { classId, completionPct, totalHomeworks: classHws.length, studentCount, pendingReview }
}

export function computeRiskyStudents(
  students: AnalitikStudent[],
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
): RiskyStudent[] {
  // O(h): class → hw ID'leri
  const hwIdsByClass = new Map<string, Set<string>>()
  for (const hw of homeworks) {
    const s = hwIdsByClass.get(hw.class_id) ?? new Set<string>()
    s.add(hw.id)
    hwIdsByClass.set(hw.class_id, s)
  }

  // O(s): öğrenci → eksik/yapılmadı ödev ID'leri
  const missedHwsByStudent = new Map<string, Set<string>>()
  for (const sub of submissions) {
    if (sub.status !== 'yapilmadi' && sub.status !== 'eksik') continue
    const s = missedHwsByStudent.get(sub.student_id) ?? new Set<string>()
    s.add(sub.homework_id)
    missedHwsByStudent.set(sub.student_id, s)
  }

  return students
    .map(s => {
      const classHwIds  = hwIdsByClass.get(s.class_id) ?? new Set<string>()
      const missedHwIds = missedHwsByStudent.get(s.id) ?? new Set<string>()
      let missedCount = 0
      for (const hwId of missedHwIds) {
        if (classHwIds.has(hwId)) missedCount++
      }
      return {
        student_id:    s.id,
        full_name:     s.full_name,
        student_number: s.student_number,
        class_id:      s.class_id,
        missedCount,
        totalHomeworks: classHwIds.size,
      }
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

// riskyStudentCount dışarıdan geçirilir — analitik/page.tsx zaten computeRiskyStudents çağırıyor,
// burada ikinci kez hesaplamaya gerek yok.
export function computeKpiCards(
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  students: AnalitikStudent[],
  riskyStudentCount: number,
): KpiCards {
  const totalHomeworks = homeworks.length

  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  // O(m) tek geçişte submission istatistikleri
  const subsByHw = new Map<string, { yapildi: number; mazeretli: number; total: number }>()
  for (const s of submissions) {
    const cur = subsByHw.get(s.homework_id) ?? { yapildi: 0, mazeretli: 0, total: 0 }
    cur.total++
    if (s.status === 'yapildi') cur.yapildi++
    else if (s.status === 'mazeretli') cur.mazeretli++
    subsByHw.set(s.homework_id, cur)
  }

  let completionSum = 0
  let counted       = 0
  for (const hw of homeworks) {
    const count = studentsByClass.get(hw.class_id) ?? 0
    if (count === 0) continue
    const { yapildi = 0, mazeretli = 0 } = subsByHw.get(hw.id) ?? { yapildi: 0, mazeretli: 0, total: 0 }
    const eligible = count - mazeretli
    if (eligible > 0) { completionSum += Math.round((yapildi / eligible) * 100); counted++ }
  }
  const avgCompletionPct = counted === 0 ? 0 : Math.round(completionSum / counted)

  const today = todayTR()
  const pendingReviewCount = homeworks.filter(h => {
    if (!h.due_date || h.due_date >= today) return false
    const classStudentCount = studentsByClass.get(h.class_id) ?? 0
    return classStudentCount > 0 && (subsByHw.get(h.id)?.total ?? 0) < classStudentCount
  }).length

  return { totalHomeworks, avgCompletionPct, riskyStudentCount, pendingReviewCount }
}

// --- Başarı Haritası (sınıf × hafta heatmap) ---
export type HeatLevel = 'high' | 'mid' | 'low'
export type HeatCell = { pct: number; level: HeatLevel }
export type HeatRow = { classId: string; className: string; cells: (HeatCell | null)[] }
export type ClassWeekHeatmap = { weeks: string[]; rows: HeatRow[] }

// Girdi: tamamlanma yüzdesi (0-100). Çıktı: renk/ikon seviyesi.
export function heatLevel(pct: number): HeatLevel {
  if (pct >= 75) return 'high'
  if (pct >= 50) return 'mid'
  return 'low'
}

// Girdi: ödevler + gönderiler + öğrenciler + sınıflar (id/ad).
// Çıktı: sınıf satırları × hafta sütunları; her hücre o sınıfın o haftaki tamamlanma %'si
// (yapildi / (slot - mazeretli)), o hafta ödevi yoksa null. En fazla son 8 hafta.
export function computeClassWeekHeatmap(
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  students: AnalitikStudent[],
  classes: { id: string; name: string }[],
): ClassWeekHeatmap {
  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  // Her ödeve hafta anahtarı ekle (due_date'i olmayanlar atlanır).
  const datedHws = homeworks
    .filter(h => h.due_date !== null)
    .map(h => ({
      ...h,
      weekKey: startOfWeek(parseISO(h.due_date as string), { weekStartsOn: 1 }).toISOString().slice(0, 10),
    }))

  const weeks = [...new Set(datedHws.map(h => h.weekKey))].sort((a, b) => a.localeCompare(b)).slice(-8)
  const weekSet = new Set(weeks)
  if (weeks.length === 0) return { weeks: [], rows: [] }

  // submission'ları ödev bazında topla (tek geçiş).
  const subsByHw = new Map<string, { yapildi: number; mazeretli: number }>()
  for (const s of submissions) {
    const cur = subsByHw.get(s.homework_id) ?? { yapildi: 0, mazeretli: 0 }
    if (s.status === 'yapildi') cur.yapildi++
    else if (s.status === 'mazeretli') cur.mazeretli++
    subsByHw.set(s.homework_id, cur)
  }

  // (classId|weekKey) → o gruptaki ödevler
  const cellHws = new Map<string, typeof datedHws>()
  for (const h of datedHws) {
    if (!weekSet.has(h.weekKey)) continue
    const key = `${h.class_id}|${h.weekKey}`
    const list = cellHws.get(key) ?? []
    list.push(h)
    cellHws.set(key, list)
  }

  const rows: HeatRow[] = []
  for (const cls of classes) {
    // Bu sınıfın gösterilen haftalar içinde hiç ödevi yoksa satırı atla.
    const hasAny = weeks.some(w => cellHws.has(`${cls.id}|${w}`))
    if (!hasAny) continue

    const studentCount = studentsByClass.get(cls.id) ?? 0
    const cells = weeks.map((w): HeatCell | null => {
      const list = cellHws.get(`${cls.id}|${w}`)
      if (!list || list.length === 0) return null
      const totalSlots = list.length * studentCount
      let yapildi = 0
      let mazeretli = 0
      for (const h of list) {
        const c = subsByHw.get(h.id)
        if (c) { yapildi += c.yapildi; mazeretli += c.mazeretli }
      }
      const eligible = totalSlots - mazeretli
      const pct = eligible <= 0 ? 0 : Math.round((yapildi / eligible) * 100)
      return { pct, level: heatLevel(pct) }
    })
    rows.push({ classId: cls.id, className: cls.name, cells })
  }

  return { weeks, rows }
}

export type TeacherStat = {
  teacher_id: string
  full_name: string
  homeworkCount: number
  avgCompletionPct: number
  riskyStudentCount: number
}

export function computeTeacherStats(
  teachers: { id: string; full_name: string }[],
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  students: AnalitikStudent[],
): TeacherStat[] {
  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  return teachers
    .map(t => {
      const teacherHws    = homeworks.filter(h => h.teacher_id === t.id)
      const homeworkCount = teacherHws.length
      if (homeworkCount === 0) return null

      const teacherHwIds = new Set(teacherHws.map(h => h.id))

      const subsByHw = new Map<string, { yapildi: number; mazeretli: number }>()
      for (const s of submissions) {
        if (!teacherHwIds.has(s.homework_id)) continue
        const cur = subsByHw.get(s.homework_id) ?? { yapildi: 0, mazeretli: 0 }
        if (s.status === 'yapildi')        cur.yapildi++
        else if (s.status === 'mazeretli') cur.mazeretli++
        subsByHw.set(s.homework_id, cur)
      }
      let completionSum = 0
      let counted = 0
      for (const hw of teacherHws) {
        const count = studentsByClass.get(hw.class_id) ?? 0
        if (count === 0) continue
        const { yapildi = 0, mazeretli = 0 } = subsByHw.get(hw.id) ?? { yapildi: 0, mazeretli: 0 }
        const eligible = count - mazeretli
        if (eligible > 0) { completionSum += Math.round((yapildi / eligible) * 100); counted++ }
      }
      const avgCompletionPct = counted === 0 ? 0 : Math.round(completionSum / counted)

      const missedByStudent = new Map<string, number>()
      for (const s of submissions) {
        if (!teacherHwIds.has(s.homework_id)) continue
        if (s.status !== 'yapilmadi' && s.status !== 'eksik') continue
        missedByStudent.set(s.student_id, (missedByStudent.get(s.student_id) ?? 0) + 1)
      }
      const riskyStudentCount = [...missedByStudent.values()].filter(c => c >= 3).length

      return { teacher_id: t.id, full_name: t.full_name, homeworkCount, avgCompletionPct, riskyStudentCount }
    })
    .filter((t): t is TeacherStat => t !== null)
    .sort((a, b) => b.homeworkCount - a.homeworkCount)
}
