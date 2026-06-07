import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import Link from 'next/link'
import { deleteHomework } from '@/src/domains/homework/actions'
import { isPast, parseISO } from '@/src/shared/date'
import OdevlerFilterBar from './FilterBar'
import SwipeableHomeworkCard from './SwipeableHomeworkCard'
import RaporButton from '@/components/RaporButton'
import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'
import { BulkProvider, BulkModeToggle } from './BulkContext'
import OlusturulduBanner from './OlusturulduBanner'
import SinifChipBar from './SinifChipBar'
import HomeworkStatCards from './HomeworkStatCards'
import BekleyenKontrollerPanel from './BekleyenKontrollerPanel'
import { PENDING_REVIEW_DAYS } from '@/src/shared/constants/limits'

export const revalidate = 30

type FilterParams = {
  sinif?: string
  ders?: string
  ogretmen?: string
  q?: string
  olusturuldu?: string
  hatali?: string
}

export default async function OdevlerPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>
}) {
  const params = await searchParams
  const [user, profile, supabase] = await Promise.all([getCurrentUser(), getCurrentProfile(), createClient()])
  if (!user || !profile?.school_id) redirect('/anasayfa')
  const sid = profile.school_id

  const isZumreBaskani = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  const canWrite = isTeachingRole(profile.role)

  const subjectsQuery = isZumreBaskani
    ? supabase.from('homeworks').select('subject').eq('school_id', sid).is('deleted_at', null)
    : supabase.from('homeworks').select('subject').eq('school_id', sid).eq('teacher_id', user.id).is('deleted_at', null)

  const [classesResult, subjectsResult, teachersResult] = await Promise.all([
    supabase.from('classes').select('id, name, grade').eq('school_id', sid).is('deleted_at', null).order('grade').order('name'),
    subjectsQuery,
    isZumreBaskani
      ? supabase.from('profiles').select('id, full_name').eq('school_id', sid).order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  const classes  = classesResult.data ?? []
  const subjects = [...new Set((subjectsResult.data ?? []).map((h) => h.subject).filter(Boolean))] as string[]
  const teachers = (teachersResult.data ?? []) as { id: string; full_name: string }[]

  return (
    <BulkProvider>
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-red-50/10 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 md:p-6 max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-6 gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ödevler</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/odevler/analitik"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 dark:hover:text-slate-200 shadow-sm hover:shadow transition-all"
              title="Analitik"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </Link>
            <Link
              href="/odevler/takvim"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 dark:hover:text-slate-200 shadow-sm hover:shadow transition-all"
              title="Takvim görünümü"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </Link>
            <RaporButton classes={classes} />
            {canWrite && <BulkModeToggle canWrite={canWrite} />}
            {canWrite && (
              <Link
                href="/odevler/yeni"
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-blue-500/35 transition-all duration-200"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Yeni Ödev</span>
              </Link>
            )}
          </div>
        </div>

        <OlusturulduBanner olusturuldu={params.olusturuldu} hatali={params.hatali} />

        <OdevlerFilterBar
          classes={classes}
          subjects={subjects}
          teachers={isZumreBaskani ? teachers : []}
          currentParams={params}
        />

        <Suspense fallback={<HomeworkListSkeleton />}>
          <HomeworkSection
            params={params}
            userId={user.id}
            schoolId={sid}
            isZumreBaskani={isZumreBaskani}
            canWrite={canWrite}
            classes={classes}
          />
        </Suspense>
      </div>
    </div>
    </BulkProvider>
  )
}

function HomeworkListSkeleton() {
  return (
    <div className="animate-pulse space-y-3 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-28 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
      ))}
    </div>
  )
}

async function HomeworkSection({
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

  let query = supabase
    .from('homeworks')
    .select('id, title, subject, due_date, class_id, teacher_id, description, classes(id, name, grade), teacher:profiles(full_name)')
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

  const homeworks = (await query).data ?? []

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

  type StatusCounts = { yapildi: number; eksik: number; yapilmadi: number; gec: number; mazeretli: number }
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
        pendingCheck={pendingCheck.map(hw => ({ ...hw, classes: hw.classes as unknown as { name: string } | null }))}
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
    </>
  )
}

function SectionHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-1.5 h-4 ${color} rounded-full`} />
      <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
        {label} · {count}
      </h2>
    </div>
  )
}

type HW = { id: string; title: string; subject: string; due_date: string; class_id: unknown; description: string | null; classes: unknown; teacher?: unknown }
type StatusCounts = { yapildi: number; eksik: number; yapilmadi: number; gec: number; mazeretli: number }

function HomeworkCard({ hw, overdue, canWrite, statusMap, classStudentMap }: {
  hw: HW
  overdue: boolean
  canWrite: boolean
  statusMap: Map<string, StatusCounts>
  classStudentMap: Map<string, number>
}) {
  const cls     = hw.classes as { name: string } | null
  const teacher = (hw as HW & { teacher?: { full_name: string } | null }).teacher

  function dueDateStr(due: string) {
    try {
      return new Date(due + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return due }
  }

  return (
    <SwipeableHomeworkCard
      id={hw.id}
      title={hw.title}
      subject={hw.subject}
      className={cls?.name ?? '—'}
      dueDateStr={dueDateStr(hw.due_date)}
      dueDate={hw.due_date}
      overdue={overdue}
      description={hw.description ?? undefined}
      teacherName={(teacher as { full_name: string } | null | undefined)?.full_name ?? undefined}
      canWrite={canWrite}
      statusCounts={statusMap.get(hw.id)}
      totalStudents={classStudentMap.get(hw.class_id as string) ?? 0}
      onDelete={deleteHomework.bind(null, hw.id)}
    />
  )
}

function PastDoneSection({ pastDone, canWrite, statusMap, classStudentMap }: {
  pastDone: HW[]
  canWrite: boolean
  statusMap: Map<string, StatusCounts>
  classStudentMap: Map<string, number>
}) {
  let totalPossible = 0
  let totalYapildi  = 0
  for (const hw of pastDone) {
    const total  = classStudentMap.get(hw.class_id as string) ?? 0
    const counts = statusMap.get(hw.id)
    totalPossible += total
    totalYapildi  += counts?.yapildi ?? 0
  }
  const avgPct = totalPossible > 0 ? Math.round((totalYapildi / totalPossible) * 100) : null

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <SectionHeader label="Geçmiş" count={pastDone.length} color="bg-slate-300 dark:bg-slate-600" />
        {avgPct !== null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            avgPct >= 75
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : avgPct >= 50
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            Ort. %{avgPct} tamamlandı
          </span>
        )}
      </div>
      <div className="space-y-3 opacity-80">
        {pastDone.map(hw => <HomeworkCard key={hw.id} hw={hw} overdue={true} canWrite={canWrite} statusMap={statusMap} classStudentMap={classStudentMap} />)}
      </div>
    </section>
  )
}

function EmptyState({ hasFilters, canWrite }: { hasFilters: boolean; canWrite: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      {hasFilters ? (
        <>
          <p className="text-gray-900 dark:text-slate-100 font-semibold text-base">Bu kriterlere uygun ödev bulunamadı</p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs">Farklı filtreler deneyin veya filtreyi temizleyin.</p>
          <Link
            href="/odevler"
            className="mt-5 flex items-center gap-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Filtreyi Sıfırla
          </Link>
        </>
      ) : (
        <>
          <p className="text-gray-900 dark:text-slate-100 font-semibold text-base">Henüz ödev yok</p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs">Sınıflarınıza ödev tanımlamak için yeni bir ödev oluşturun.</p>
          {canWrite && (
            <Link
              href="/odevler/yeni"
              className="mt-5 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              İlk Ödevi Oluştur
            </Link>
          )}
        </>
      )}
    </div>
  )
}
