import { Suspense } from 'react'
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import MudurDashboard from './MudurDashboard'
import MudurYardimcisiDashboard from './MudurYardimcisiDashboard'
import OgretmenDashboard from './OgretmenDashboard'

export const revalidate = 60

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

export default async function AnasayfaPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  if (profile.role === 'mudur') {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <MudurDashboard fullName={profile.full_name ?? ''} />
      </Suspense>
    )
  }

  if (profile.role === 'mudur_yardimcisi') {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <MudurYardimcisiDashboard fullName={profile.full_name ?? ''} />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <OgretmenDashboard />
    </Suspense>
  )
}
