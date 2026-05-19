import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import Link from 'next/link'
import { addDays, format, parseISO } from '@/src/shared/date'
import CalendarWidget from './CalendarWidget'
import SubmissionsPanel, { SubmissionsPanelSkeleton } from './SubmissionsPanel'
import MufredatWidget from './MufredatWidget'
import MudurDashboard from './MudurDashboard'
import MudurYardimcisiDashboard from './MudurYardimcisiDashboard'
import MentorSinifimWidget from './MentorSinifimWidget'
import DersProgramiWidget from './DersProgramiWidget'

export const revalidate = 60

type ClassRel = { name: string; grade: number } | null
type HwLite = {
  id: string
  title: string
  subject: string
  due_date: string
  class_id: string
  classes: ClassRel
}

export default async function AnasayfaPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user) return null

  if (profile?.role === 'mudur') {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <MudurDashboard fullName={profile.full_name ?? ''} />
      </Suspense>
    )
  }

  if (profile?.role === 'mudur_yardimcisi') {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <MudurYardimcisiDashboard fullName={profile.full_name ?? ''} />
      </Suspense>
    )
  }

  const isZumreBaskani = profile?.role === 'zumre_baskani'
  const supabase = await createClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const next7Str = addDays(today, 7).toISOString().split('T')[0]

  let hwQuery = supabase
    .from('homeworks')
    .select('id, title, subject, due_date, class_id, classes(name, grade)')
    .order('due_date', { ascending: false })
  if (!isZumreBaskani) hwQuery = hwQuery.eq('teacher_id', user.id)

  const [{ data: hwData }, { data: curriculumRaw }] = await Promise.all([
    hwQuery,
    supabase
      .from('curriculum_progress')
      .select('class_id, status, classes(name, grade)')
      .eq('teacher_id', user.id),
  ])
  const homeworks = (hwData ?? []) as unknown as HwLite[]
  type CurrRaw = { class_id: string; status: string; classes: { name: string; grade: number } | null }
  const curriculum = (curriculumRaw ?? []) as unknown as CurrRaw[]
  const hwIds = homeworks.map((h) => h.id)

  const todayHws = homeworks.filter((h) => h.due_date === todayStr)
  const upcomingHws = homeworks
    .filter((h) => h.due_date > todayStr && h.due_date <= next7Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Anasayfa</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Merhaba {profile?.full_name ?? ''} · hızlı özet aşağıda.
        </p>
      </div>

      <Suspense fallback={<SubmissionsPanelSkeleton />}>
        <SubmissionsPanel
          hwIds={hwIds}
          homeworks={homeworks}
          todayCount={todayHws.length}
          upcomingCount={upcomingHws.length}
        />
      </Suspense>

      {curriculum.length > 0 && <MufredatWidget curriculum={curriculum} />}

      <Suspense fallback={null}>
        <MentorSinifimWidget />
      </Suspense>

      <Suspense fallback={null}>
        <DersProgramiWidget />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <section className="lg:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bugün ve Yaklaşan</h2>
            <Link href="/odevler" className="text-xs text-blue-600 font-medium hover:underline">Tümü →</Link>
          </header>
          {todayHws.length + upcomingHws.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              Bugün veya önümüzdeki 7 gün için ödev yok.
            </p>
          ) : (
            <ul className="space-y-2">
              {[
                ...todayHws.map((h) => ({ ...h, isToday: true })),
                ...upcomingHws.map((h) => ({ ...h, isToday: false })),
              ].map((hw) => (
                <li key={hw.id}>
                  <Link
                    href={`/odevler/${hw.id}`}
                    className="block rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{hw.title}</span>
                      {hw.isToday && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">BUGÜN</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {hw.classes?.name ?? '—'} · {hw.subject} ·{' '}
                      {(() => {
                        try { return format(parseISO(hw.due_date), 'd MMM') }
                        catch { return hw.due_date }
                      })()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <CalendarWidget />
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5 animate-pulse">
      <div className="h-8 w-72 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      <div className="flex gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-7 w-32 bg-gray-100 dark:bg-slate-800 rounded-full" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  )
}
