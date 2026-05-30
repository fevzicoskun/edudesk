import { Suspense } from 'react'
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from '@/src/shared/date'
import OgretmenDashboard          from './OgretmenDashboard'
import GundemWidget                from './GundemWidget'
import MudurGunlukOzetKartlari    from './MudurGunlukOzetKartlari'
import MudurOgretmenAktivite      from './MudurOgretmenAktivite'
import MudurSonDuyurular          from './MudurSonDuyurular'


import MYStatsWidget       from './MYStatsWidget'
import MYSolSutunWidget    from './MYSolSutunWidget'
import AjandaSection       from './AjandaSection'
import SinavOrtalamaWidget from './SinavOrtalamaWidget'

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
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Günlük Durum</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {fullName} · {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {/* Günlük özet kartları */}
      <Suspense fallback={<WidgetSkeleton />}>
        <MudurGunlukOzetKartlari />
      </Suspense>

      {/* Gündem + Öğretmen yoklama durumu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<WidgetSkeleton tall />}>
          <GundemWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton tall />}>
          <MudurOgretmenAktivite />
        </Suspense>
      </div>

      {/* Son duyurular */}
      <Suspense fallback={<WidgetSkeleton />}>
        <MudurSonDuyurular />
      </Suspense>

      {/* Sınav ortalamaları */}
      <Suspense fallback={<WidgetSkeleton tall />}>
        <SinavOrtalamaWidget />
      </Suspense>

    </div>
  )
}

async function MYWidgets({ fullName }: { fullName: string }) {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yönetim Paneli</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {fullName} · {format(new Date(), 'd MMMM yyyy, EEEE')}
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

      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Hızlı Erişim</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/siniflar',     label: 'Sınıf Listeleri',    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',     icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
            { href: '/kullanicilar', label: 'Kullanıcı Yönetimi', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
          ].map(item => (
            <Link key={item.href + item.label} href={item.href} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>{item.icon}</div>
              <span className="text-xs font-medium text-gray-800 dark:text-slate-200">{item.label}</span>
            </Link>
          ))}
        </div>
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
