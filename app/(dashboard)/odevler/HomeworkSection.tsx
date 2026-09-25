import { createClient } from '@/src/infrastructure/supabase/server'
import { kategorizeOdev } from '@/src/domains/homework/homeworkMath'
import SinifChipBar from './SinifChipBar'
import BekleyenKontrollerPanel from './BekleyenKontrollerPanel'
import HomeworkCard from './HomeworkCard'
import PastDoneSection from './PastDoneSection'
import PaginationBar from './PaginationBar'
import EmptyState from './EmptyState'
import SectionHeader, { LISTE } from './SectionHeader'
import type { FilterParams, StatusCounts } from './types'
import type { OdevKapsami } from '@/src/domains/homework/lib/kapsam'

const PAGE_SIZE = 50

export default async function HomeworkSection({
  params,
  userId,
  schoolId,
  kapsam,
  canWrite,
  classes,
}: {
  params: FilterParams
  userId: string
  schoolId: string
  kapsam: OdevKapsami
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

  if (!kapsam.tumu) query = query.in('teacher_id', kapsam.ogretmenIds)
  // URL'deki öğretmen filtresi kapsamı genişletemez: kapsam dışı id → boş liste
  if (params.ogretmen) query = query.eq('teacher_id', params.ogretmen)

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
      ? supabase.from('homework_submissions').select('homework_id, status, marked_at').in('homework_id', homeworkIds).eq('school_id', schoolId)
      : Promise.resolve({ data: [] as { homework_id: string; status: string; marked_at: string | null }[] }),
    classIds.length > 0
      ? supabase.from('students').select('class_id').in('class_id', classIds).eq('school_id', schoolId).is('deleted_at', null)
      : Promise.resolve({ data: [] as { class_id: string }[] }),
  ])

  // Satırlar ödevle birlikte otomatik yaratılır; yalnız marked_at dolu olanlar
  // öğretmenin gerçekten işaretlediğini gösterir (2026-09-19 bulgusu).
  const statusMap = new Map<string, StatusCounts>()
  for (const s of subStatsRes.data ?? []) {
    if (!s.marked_at) continue
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
    const counts = statusMap.get(hw.id)
    const kategori = kategorizeOdev({
      dueDate:        hw.due_date,
      isaretliSayisi: counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0,
      ogrenciSayisi:  classStudentMap.get(hw.class_id as string) ?? 0,
    }, now)

    if (kategori === 'aktif')                 active.push(hw)
    else if (kategori === 'kontrolBekliyor')  pendingCheck.push(hw)
    else                                      pastDone.push(hw)
  }

  active.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })

  const hasFilters = !!(params.sinif || params.ders || params.ogretmen || params.q)

  const pendingByClass = new Map<string, number>()
  for (const hw of pendingCheck) pendingByClass.set(hw.class_id as string, (pendingByClass.get(hw.class_id as string) ?? 0) + 1)

  return (
    <>
      <SinifChipBar classes={classes} pendingByClass={pendingByClass} params={params} />
      {homeworks.length === 0 ? (
        <EmptyState hasFilters={hasFilters} canWrite={canWrite} />
      ) : (
        <>
          {/* Masaüstünde iki bölüm yan yana — tek sütunda satırlar ekran boyu uzayıp ortası boş kalıyordu */}
          <div className={`mb-6 ${pendingCheck.length > 0 && active.length > 0 ? 'grid gap-6 lg:grid-cols-2 items-start' : ''}`}>
            <BekleyenKontrollerPanel
              pendingCheck={pendingCheck.map(hw => ({ ...hw, classes: hw.classes as { name: string } | null }))}
              statusMap={statusMap}
              classStudentMap={classStudentMap}
              now={now}
            />
            {active.length > 0 && (
              <section>
                <SectionHeader label="Aktif" count={active.length} />
                <div className={LISTE}>
                  {active.map(hw => <HomeworkCard key={hw.id} hw={hw} overdue={false} canWrite={canWrite && hw.teacher_id === userId} userId={userId} statusMap={statusMap} classStudentMap={classStudentMap} />)}
                </div>
              </section>
            )}
          </div>

          {pastDone.length > 0 && (
            <PastDoneSection pastDone={pastDone} canWrite={canWrite} userId={userId} statusMap={statusMap} classStudentMap={classStudentMap} />
          )}
        </>
      )}

      {totalPages > 1 && (
        <PaginationBar page={page} totalPages={totalPages} totalCount={totalCount} params={params} />
      )}
    </>
  )
}
