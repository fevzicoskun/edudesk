import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import Link from 'next/link'
import OdevlerFilterBar from './FilterBar'
import RaporButton from '@/components/RaporButton'
import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'
import { BulkProvider, BulkModeToggle } from './BulkContext'
import OlusturulduBanner from './OlusturulduBanner'
import HomeworkSection from './HomeworkSection'
import HomeworkListSkeleton from './HomeworkListSkeleton'
import type { FilterParams } from './types'

export const revalidate = 30

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
