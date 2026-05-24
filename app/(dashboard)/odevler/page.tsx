import { Suspense } from 'react'
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

type FilterParams = {
  sinif?: string
  baslangic?: string
  bitis?: string
  ders?: string
  durum?: string
  ogretmen?: string
  q?: string
}

export default async function OdevlerPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>
}) {
  const params = await searchParams
  const [user, profile, supabase] = await Promise.all([getCurrentUser(), getCurrentProfile(), createClient()])
  if (!user || !profile?.school_id) return null
  const sid = profile.school_id

  const isZumreBaskani = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  const canWrite = isTeachingRole(profile.role)

  const subjectsQuery = isZumreBaskani
    ? supabase.from('homeworks').select('subject').is('deleted_at', null)
    : supabase.from('homeworks').select('subject').eq('teacher_id', user.id).is('deleted_at', null)

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
            <RaporButton classes={classes} />
            {canWrite && (
              <Link
                href="/odevler/yeni"
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-blue-500/35 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Yeni Ödev
              </Link>
            )}
          </div>
        </div>

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
  isZumreBaskani,
  canWrite,
}: {
  params: FilterParams
  userId: string
  isZumreBaskani: boolean
  canWrite: boolean
}) {
  const supabase = await createClient()

  const durumResult = params.durum
    ? await supabase.from('homework_submissions').select('homework_id').eq('status', params.durum)
    : { data: null as { homework_id: string }[] | null }

  const durumIds = durumResult.data
    ? [...new Set(durumResult.data.map((s) => s.homework_id))]
    : null

  let query = supabase
    .from('homeworks')
    .select('*, classes(id, name, grade), teacher:profiles(full_name)')
    .is('deleted_at', null)
    .order('due_date', { ascending: false })

  if (!isZumreBaskani) {
    query = query.eq('teacher_id', userId)
  } else if (params.ogretmen) {
    query = query.eq('teacher_id', params.ogretmen)
  }

  if (params.sinif) query = query.eq('class_id', params.sinif)
  if (params.baslangic) query = query.gte('due_date', params.baslangic)
  if (params.bitis) query = query.lte('due_date', params.bitis)
  if (params.ders) query = query.eq('subject', params.ders)
  if (params.q) query = query.ilike('title', `%${params.q}%`)
  if (durumIds !== null) {
    query = query.in('id', durumIds.length > 0 ? durumIds : ['00000000-0000-0000-0000-000000000000'])
  }

  const homeworks = (await query).data ?? []
  const activeCount = homeworks.filter((hw) => !isPast(parseISO(hw.due_date + 'T23:59:59'))).length
  const overdueCount = homeworks.length - activeCount

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 mt-4">
        {[
          { label: 'Toplam', value: homeworks.length, color: 'text-gray-900' },
          { label: 'Aktif', value: activeCount, color: 'text-emerald-600' },
          { label: 'Geçmiş', value: overdueCount, color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3.5 shadow-sm">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {homeworks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold text-base">Henüz ödev yok</p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs">
            Sınıflarınıza ödev tanımlamak için yeni bir ödev oluşturun.
          </p>
          {canWrite && (
            <Link
              href="/odevler/yeni"
              className="mt-5 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-blue-500/35 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              İlk Ödevi Oluştur
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {homeworks.map((hw) => {
            const overdue = isPast(parseISO(hw.due_date + 'T23:59:59'))
            const cls = hw.classes as { name: string } | null
            const teacher = (hw as typeof hw & { teacher?: { full_name: string } | null }).teacher

            let dueDateStr = 'Tarih yok'
            try {
              if (hw.due_date) dueDateStr = format(parseISO(hw.due_date), 'd MMM yyyy')
            } catch { /* keep default */ }

            return (
              <SwipeableHomeworkCard
                key={hw.id}
                id={hw.id}
                title={hw.title}
                subject={hw.subject}
                className={cls?.name ?? '—'}
                dueDateStr={dueDateStr}
                overdue={overdue}
                description={hw.description ?? undefined}
                teacherName={teacher?.full_name ?? undefined}
                canWrite={canWrite}
                onDelete={deleteHomework.bind(null, hw.id)}
              />
            )
          })}
        </div>
      )}
    </>
  )
}
