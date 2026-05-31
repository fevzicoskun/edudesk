import { Suspense } from 'react'
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { format } from '@/src/shared/date'
import OgretmenDashboard     from './OgretmenDashboard'
import GundemWidget           from './GundemWidget'
import MudurOgretmenAktivite from './MudurOgretmenAktivite'
import MudurSonDuyurular     from './MudurSonDuyurular'
import MYStatsWidget          from './MYStatsWidget'
import MYSolSutunWidget       from './MYSolSutunWidget'
import AjandaSection          from './AjandaSection'
import SinavOrtalamaWidget    from './SinavOrtalamaWidget'

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

function getMudurGreeting(fullName: string): string {
  const hour = (new Date().getUTCHours() + 3) % 24
  const firstName = fullName.split(' ')[0]
  if (hour < 12) return `Günaydın, ${firstName}`
  if (hour < 18) return `İyi günler, ${firstName}`
  return `İyi akşamlar, ${firstName}`
}

async function MudurWidgets({ fullName }: { fullName: string }) {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Başlık */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {getMudurGreeting(fullName)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {/* Alert + Stat kartları */}
      <Suspense fallback={<><WidgetSkeleton /><WidgetSkeleton /></>}>
        <MYStatsWidget />
      </Suspense>

      {/* Ana grid: Sol (risk + öğretmenler) | Sağ (gündem) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<WidgetSkeleton tall />}>
          <MYSolSutunWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton tall />}>
          <GundemWidget />
        </Suspense>
      </div>

      {/* Alt grid: öğretmen aktivitesi | son duyurular */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<WidgetSkeleton tall />}>
          <MudurOgretmenAktivite />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton />}>
          <MudurSonDuyurular />
        </Suspense>
      </div>

      {/* Sınav ortalamaları */}
      <Suspense fallback={<WidgetSkeleton tall />}>
        <SinavOrtalamaWidget />
      </Suspense>

    </div>
  )
}

async function MYWidgets({ fullName }: { fullName: string }) {
  const hour = (new Date().getUTCHours() + 3) % 24
  const firstName = fullName.split(' ')[0]
  const greeting = hour < 12 ? `Günaydın, ${firstName}` : hour < 18 ? `İyi günler, ${firstName}` : `İyi akşamlar, ${firstName}`

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{greeting}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      <Suspense fallback={<><WidgetSkeleton /><WidgetSkeleton /></>}>
        <MYStatsWidget />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<WidgetSkeleton tall />}>
          <MYSolSutunWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton tall />}>
          <AjandaSection />
        </Suspense>
      </div>

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
