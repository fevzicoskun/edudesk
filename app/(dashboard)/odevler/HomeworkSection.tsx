import { createClient } from '@/src/infrastructure/supabase/server'
import { isPast, parseISO } from '@/src/shared/date'
import { PENDING_REVIEW_DAYS } from '@/src/shared/constants/limits'
import SinifChipBar from './SinifChipBar'
import HomeworkStatCards from './HomeworkStatCards'
import BekleyenKontrollerPanel from './BekleyenKontrollerPanel'
import HomeworkCard from './HomeworkCard'
import PastDoneSection from './PastDoneSection'
import PaginationBar from './PaginationBar'
import EmptyState from './EmptyState'
import SectionHeader from './SectionHeader'
import type { FilterParams, StatusCounts } from './types'

const PAGE_SIZE = 50

export default async function HomeworkSection({
  params,
  userId,
  schoolId,
  isZumreBaskani,
  canWrite,
  classes,
}: {
  params: FilterParams
  userId: string
  schoolId: string
  isZumreBaskani: boolean
  canWrite: boolean
  classes: { id: string; name: string; grade: number }[]
}) {
  const supabase = await createClient()

  const page   = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('homeworks')
    .select('id, title, subject, due_date, class_id, teacher_id, description, classes(id, name, grade), teacher:profiles(full_name)', { count: 'exact' })
    .is('deleted_at', null)
    .eq('is_template', false)
    .order('due_date', { ascending: false })

  if (!isZumreBaskani) {
    query = query.eq('teacher_id', userId)
  } else if (params.ogretmen) {
    query = query.eq('teacher_id', params.ogretmen)
  }

  if (params.sinif) query = query.eq('class_id', params.sinif)
  if (params.ders)  query = query.eq('subject', params.ders)
  if (params.q)     query = query.ilike('title', `%${params.q}%`)

  const { data: hwData, count: hwCount } = await query.range(offset, offset + PAGE_SIZE - 1)
  const homeworks   = hwData ?? []
  const totalCount  = hwCount ?? 0
  const totalPages  = Math.ceil(totalCount / PAGE_SIZE)

  const homeworkIds = homeworks.map(h => h.id)
  const classIds    = [...new Set(homeworks.map(h => h.class_id as string))]

  const [subStatsRes, classCountsRes] = await Promise.all([
    homeworkIds.length > 0
      ? supabase.from('homework_submissions').select('homework_id, status').in('homework_id', homeworkIds).eq('school_id', schoolId)
      : Promise.resolve({ data: [] as { homework_id: string; status: string }[] }),
    classIds.length > 0
      ? supabase.from('students').select('class_id').in('class_id', classIds).eq('school_id', schoolId).is('deleted_at', null)
      : Promise.resolve({ data: [] as { class_id: string }[] }),
  ])

  const statusMap = new Map<string, StatusCounts>()
  for (const s of subStatsRes.data ?? []) {
    const cur = statusMap.get(s.homework_id) ?? { yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0 }
    const key = s.status as keyof StatusCounts
    if (key in cur) cur[key]++
    statusMap.set(s.homework_id, cur)
  }

  const classStudentMap = new Map<string, number>()
  for (const s of classCountsRes.data ?? []) {
    classStudentMap.set(s.class_id, (classStudentMap.get(s.class_id) ?? 0) + 1)
  }

  // Kategorize
  const now          = new Date()
  const pendingCheck: typeof homeworks = []
  const active:       typeof homeworks = []
  const pastDone:     typeof homeworks = []

  for (const hw of homeworks) {
    if (!hw.due_date) { active.push(hw); continue }
    const overdue = isPast(parseISO(hw.due_date + 'T23:59:59'))
    if (!overdue) { active.push(hw); continue }

    const counts    = statusMap.get(hw.id)
    const checked   = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
    const total     = classStudentMap.get(hw.class_id as string) ?? 0
    const age       = Math.floor((now.getTime() - new Date(hw.due_date).getTime()) / 86_400_000)
    const halfEntered = total > 0 ? checked >= Math.ceil(total / 2) : checked > 0
    if (!halfEntered && age <= PENDING_REVIEW_DAYS) pendingCheck.push(hw)
    else                                     pastDone.push(hw)
  }

  active.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })

  const hasFilters = !!(params.sinif || params.ders || params.ogretmen || params.q)

  const activeByClass  = new Map<string, number>()
  const pendingByClass = new Map<string, number>()
  for (const hw of active)       activeByClass.set(hw.class_id as string, (activeByClass.get(hw.class_id as string) ?? 0) + 1)
  for (const hw of pendingCheck) pendingByClass.set(hw.class_id as string, (pendingByClass.get(hw.class_id as string) ?? 0) + 1)

  return (
    <>
      <SinifChipBar classes={classes} activeByClass={activeByClass} pendingByClass={pendingByClass} />
      <HomeworkStatCards activeCount={active.length} pendingCount={pendingCheck.length} />
      <BekleyenKontrollerPanel
        pendingCheck={pendingCheck.map(hw => ({ ...hw, classes: hw.classes as { name: string } | null }))}
        statusMap={statusMap}
        classStudentMap={classStudentMap}
        now={now}
      />

      {homeworks.length === 0 ? (
        <EmptyState hasFilters={hasFilters} canWrite={canWrite} />
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-6">
              <SectionHeader label="Aktif" count={active.length} color="bg-emerald-500" />
              <div className="space-y-3">
                {active.map(hw => <HomeworkCard key={hw.id} hw={hw} overdue={false} canWrite={canWrite} statusMap={statusMap} classStudentMap={classStudentMap} />)}
              </div>
            </section>
          )}

          {pastDone.length > 0 && (
            <PastDoneSection pastDone={pastDone} canWrite={canWrite} statusMap={statusMap} classStudentMap={classStudentMap} />
          )}
        </>
      )}

      {totalPages > 1 && (
        <PaginationBar page={page} totalPages={totalPages} totalCount={totalCount} params={params} />
      )}
    </>
  )
}
