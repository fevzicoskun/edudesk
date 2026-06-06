import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import Link from 'next/link'
import { deleteHomework } from '@/src/domains/homework/actions'
import { format, isPast, parseISO } from '@/src/shared/date'
import OdevlerFilterBar from './FilterBar'
import SwipeableHomeworkCard from './SwipeableHomeworkCard'
import RaporButton from '@/components/RaporButton'
import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'

export const revalidate = 30

const PENDING_DAYS = 30

function dueDateStr(due: string): string {
  try { return format(parseISO(due), 'd MMM yyyy') } catch { return due }
}

function daysSinceDue(due: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(due).getTime()) / 86_400_000)
}

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
    supabase.from('classes').select('id, name, grade').eq('school_id', sid).order('grade').order('name'),
    subjectsQuery,
    isZumreBaskani
      ? supabase.from('profiles').select('id, full_name').eq('school_id', sid).order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  const classes = classesResult.data ?? []
  const subjects = [...new Set((subjectsResult.data ?? []).map((h) => h.subject).filter(Boolean))] as string[]
  const teachers = (teachersResult.data ?? []) as { id: string; full_name: string }[]

  return (
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

        {params.olusturuldu && parseInt(params.olusturuldu) > 0 && (
          <div className={`mb-4 flex items-start gap-2 border text-sm px-4 py-3 rounded-xl ${
            params.hatali
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
          }`}>
            <svg className={`w-4 h-4 shrink-0 mt-0.5 ${params.hatali ? 'text-amber-500' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={params.hatali ? 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' : 'M5 13l4 4L19 7'} />
            </svg>
            <div>
              <p>{parseInt(params.olusturuldu) === 1
                ? 'Ödev başarıyla oluşturuldu.'
                : `${parseInt(params.olusturuldu)} sınıf için ödev oluşturuldu.`}
              </p>
              {params.hatali && (
                <p className="text-xs mt-0.5 opacity-80">{parseInt(params.hatali)} sınıf için oluşturulamadı.</p>
              )}
            </div>
          </div>
        )}

        <OdevlerFilterBar
          classes={classes}
          subjects={subjects}
          teachers={isZumreBaskani ? teachers : []}
          currentParams={params}
        />

        {classes.length > 0 && (
          <div className="mt-4 mb-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Başarı Haritası
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {classes.map(cls => (
                <Link
                  key={cls.id}
                  href={`/odevler/sinif/${cls.id}`}
                  className="flex items-center gap-1.5 shrink-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" />
                  </svg>
                  {cls.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <Suspense fallback={<HomeworkListSkeleton />}>
          <HomeworkSection
            params={params}
            userId={user.id}
            schoolId={sid}
            isZumreBaskani={isZumreBaskani}
            canWrite={canWrite}
          />
        </Suspense>
      </div>
    </div>
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
}: {
  params: FilterParams
  userId: string
  schoolId: string
  isZumreBaskani: boolean
  canWrite: boolean
}) {
  const supabase = await createClient()

  let query = supabase
    .from('homeworks')
    .select('*, classes(id, name, grade), teacher:profiles(full_name)')
    .is('deleted_at', null)
    .eq('is_template', false)
    .order('due_date', { ascending: false })

  if (!isZumreBaskani) {
    query = query.eq('teacher_id', userId)
  } else if (params.ogretmen) {
    query = query.eq('teacher_id', params.ogretmen)
  }

  if (params.sinif) query = query.eq('class_id', params.sinif)
  if (params.ders) query = query.eq('subject', params.ders)
  if (params.q) query = query.ilike('title', `%${params.q}%`)

  const homeworks = (await query).data ?? []

  // Parallel: submission stats + class student counts
  const homeworkIds = homeworks.map(h => h.id)
  const classIds = [...new Set(homeworks.map(h => h.class_id as string))]

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

  // Categorize
  const now = new Date()
  const pendingCheck: typeof homeworks = []
  const active:       typeof homeworks = []
  const pastDone:     typeof homeworks = []

  for (const hw of homeworks) {
    if (!hw.due_date) { active.push(hw); continue }
    const overdue = isPast(parseISO(hw.due_date + 'T23:59:59'))
    if (!overdue) { active.push(hw); continue }

    const counts  = statusMap.get(hw.id)
    const checked = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
    const age     = daysSinceDue(hw.due_date, now)
    if (checked === 0 && age <= PENDING_DAYS) pendingCheck.push(hw)
    else                                      pastDone.push(hw)
  }

  // Sort active homeworks by closest due date first (null due_date goes last)
  active.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })

  const totalCount = homeworks.length
  const hasFilters = !!(params.sinif || params.ders || params.ogretmen || params.q)

  return (
    <>
      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 gap-3 mb-6 mt-4">
        {[
          { label: 'Aktif Ödev',        value: active.length,       color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
          { label: 'Kontrol Bekliyor',  value: pendingCheck.length, color: 'text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500'  },
        ].map(({ label, value, color, dot }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3.5 shadow-sm flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <div>
              <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bekleyen kontroller uyarısı */}
      {pendingCheck.length > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl overflow-hidden">
          <div className="flex items-start gap-3 px-4 py-3.5 border-b border-amber-200 dark:border-amber-800/60">
            <div className="w-7 h-7 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {pendingCheck.length} ödev kontrol bekliyor
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                Son tarihi geçti ve henüz hiç giriş yapılmadı.
              </p>
            </div>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-900/40">
            {pendingCheck.map(hw => {
              const cls = hw.classes as { name: string } | null
              const days = daysSinceDue(hw.due_date, now)
              return (
                <Link
                  key={hw.id}
                  href={`/odevler/${hw.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                      {hw.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {cls?.name ?? '—'} · Son: {dueDateStr(hw.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        days > 7
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {days === 0 ? 'Bugün bitti' : `${days}g önce`}
                    </span>
                    <svg className="w-4 h-4 text-amber-400 dark:text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {totalCount === 0 ? (
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
      ) : (
        <>
          {/* Aktif ödevler */}
          {active.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Aktif · {active.length}
                </h2>
              </div>
              <div className="space-y-3">
                {active.map(hw => renderCard(hw, false))}
              </div>
            </section>
          )}

          {/* Geçmiş ödevler */}
          {pastDone.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-4 bg-slate-300 dark:bg-slate-600 rounded-full" />
                <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Geçmiş · {pastDone.length}
                </h2>
              </div>
              <div className="space-y-3 opacity-80">
                {pastDone.map(hw => renderCard(hw, true))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  )

  function renderCard(hw: (typeof homeworks)[0], overdue: boolean) {
    const cls = hw.classes as { name: string } | null
    const teacher = (hw as typeof hw & { teacher?: { full_name: string } | null }).teacher
    return (
      <SwipeableHomeworkCard
        key={hw.id}
        id={hw.id}
        title={hw.title}
        subject={hw.subject}
        className={cls?.name ?? '—'}
        dueDateStr={dueDateStr(hw.due_date)}
        dueDate={hw.due_date}
        overdue={overdue}
        description={hw.description ?? undefined}
        teacherName={teacher?.full_name ?? undefined}
        canWrite={canWrite}
        statusCounts={statusMap.get(hw.id)}
        totalStudents={classStudentMap.get(hw.class_id as string) ?? 0}
        onDelete={deleteHomework.bind(null, hw.id)}
      />
    )
  }
}
