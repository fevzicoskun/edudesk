import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import Link from 'next/link'
import OdevlerFilterBar from './FilterBar'
import RaporButton from '@/components/RaporButton'
import { isTeachingRole } from '@/src/shared/types'
import { BulkProvider, BulkModeToggle } from './BulkContext'
import OlusturulduBanner from './OlusturulduBanner'
import HomeworkSection from './HomeworkSection'
import HomeworkListSkeleton from './HomeworkListSkeleton'
import type { FilterParams } from './types'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'

export const revalidate = 30

export const metadata = { title: 'Ödevler' }

const IKINCIL = 'shrink-0 px-2 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 transition-colors'

export default async function OdevlerPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>
}) {
  const params = await searchParams
  const [user, profile, supabase] = await Promise.all([getCurrentUser(), getCurrentProfile(), createClient()])
  if (!user || !profile?.school_id) redirect('/anasayfa')
  const sid = profile.school_id

  const kapsam = (await HomeworkService.getOdevKapsami()) ?? { tumu: false as const, ogretmenIds: [user.id] }
  // Birden çok öğretmenin ödevini görenlere öğretmen filtresi/adı gösterilir
  const cokOgretmen = kapsam.tumu || kapsam.ogretmenIds.length > 1
  const canWrite = isTeachingRole(profile.role)

  let subjectsQuery = supabase.from('homeworks').select('subject').eq('school_id', sid).is('deleted_at', null)
  if (!kapsam.tumu) subjectsQuery = subjectsQuery.in('teacher_id', kapsam.ogretmenIds)

  let teachersQuery = supabase.from('profiles').select('id, full_name').eq('school_id', sid).order('full_name')
  if (!kapsam.tumu) teachersQuery = teachersQuery.in('id', kapsam.ogretmenIds)

  const [classesResult, subjectsResult, teachersResult] = await Promise.all([
    supabase.from('classes').select('id, name, grade').eq('school_id', sid).is('deleted_at', null).order('grade').order('name'),
    subjectsQuery,
    cokOgretmen ? teachersQuery : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  const classes  = classesResult.data ?? []
  const subjects = [...new Set((subjectsResult.data ?? []).map((h) => h.subject).filter(Boolean))] as string[]
  const teachers = (teachersResult.data ?? []) as { id: string; full_name: string }[]

  return (
    <BulkProvider>
    <div className="min-h-full">
      <div className="p-4 md:p-6 max-w-6xl mx-auto">

        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ödevler</h1>
            {/* İkincil eylemler — hepsi aynı biçim, yazılı etiket (simge tek başına anlaşılmıyordu) */}
            <div className="flex flex-wrap items-center gap-1 -mx-2">
              <Link href="/odevler/takvim" className={IKINCIL}>Takvim</Link>
              <Link href="/odevler/analitik" className={IKINCIL}>Başarı haritası</Link>
              <RaporButton classes={classes} />
              {canWrite && <BulkModeToggle canWrite={canWrite} />}
            </div>
          </div>
          {canWrite && (
            <Link
              href="/odevler/yeni"
              className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors self-start sm:self-auto"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Yeni Ödev
            </Link>
          )}
        </div>

        <OlusturulduBanner olusturuldu={params.olusturuldu} hatali={params.hatali} />

        <OdevlerFilterBar
          subjects={subjects}
          teachers={cokOgretmen ? teachers : []}
          currentParams={params}
        />

        <Suspense fallback={<HomeworkListSkeleton />}>
          <HomeworkSection
            params={params}
            userId={user.id}
            schoolId={sid}
            kapsam={kapsam}
            canWrite={canWrite}
            classes={classes}
          />
        </Suspense>
      </div>
    </div>
    </BulkProvider>
  )
}
