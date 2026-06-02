import { Suspense } from 'react'
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { format } from '@/src/shared/date'
import OgretmenDashboard     from './OgretmenDashboard'
import MudurOgretmenAktivite from './MudurOgretmenAktivite'
import MYStatsWidget          from './MYStatsWidget'
import MYSolSutunWidget       from './MYSolSutunWidget'
import { getGreeting }        from '@/src/shared/utils'

export const revalidate = 60

function WidgetSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className={`animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800 ${tall ? 'h-64' : 'h-32'}`} />
  )
}


function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5 animate-pulse">
      <div className="h-8 w-72 bg-gray-200 dark:bg-slate-700 rounded-lg" />
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

async function MudurWidgets({ fullName }: { fullName: string }) {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Başlık */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {getGreeting(fullName)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {/* Alert + Stat kartları */}
      <Suspense fallback={<><WidgetSkeleton /><WidgetSkeleton /></>}>
        <MYStatsWidget />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<WidgetSkeleton tall />}>
          <MYSolSutunWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton tall />}>
          <MudurOgretmenAktivite />
        </Suspense>
      </div>

    </div>
  )
}

async function MYWidgets({ fullName }: { fullName: string }) {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{getGreeting(fullName)}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      <Suspense fallback={<><WidgetSkeleton /><WidgetSkeleton /></>}>
        <MYStatsWidget />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton tall />}>
        <MYSolSutunWidget />
      </Suspense>

    </div>
  )
}

export default async function AnasayfaPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const fullName = profile.full_name ?? ''

  if (profile.role === 'mudur') return <MudurWidgets fullName={fullName} />
  if (profile.role === 'mudur_yardimcisi') return <MYWidgets fullName={fullName} />

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <OgretmenDashboard />
    </Suspense>
  )
}
