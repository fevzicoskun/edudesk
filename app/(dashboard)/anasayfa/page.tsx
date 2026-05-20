import { Suspense } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from '@/src/shared/date'
import RaporButton from '@/components/RaporButton'
import OgretmenDashboard from './OgretmenDashboard'
import MudurStatsWidget    from './MudurStatsWidget'
import MudurHaftaWidget    from './MudurHaftaWidget'
import MentorOzetiWidget   from './MentorOzetiWidget'
import ZumreOgretmenWidget from './ZumreOgretmenWidget'
import AjandaSection       from './AjandaSection'

import MYStatsWidget    from './MYStatsWidget'
import MYSolSutunWidget from './MYSolSutunWidget'

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
  const supabase  = await createClient()
  const school_id = await requireSchoolId()
  const { data: classes } = await supabase
    .from('classes').select('id, name, grade').eq('school_id', school_id).order('grade').order('name')

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Okul Yönetim Paneli</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {fullName} · {format(new Date(), 'd MMMM yyyy, EEEE')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/yonetim" className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Yeni Toplantı
          </Link>
          <RaporButton classes={(classes ?? []).map(c => ({ id: c.id, name: c.name, grade: c.grade }))} />
        </div>
      </div>

      <Suspense fallback={<><WidgetSkeleton /><WidgetSkeleton /></>}>
        <MudurStatsWidget />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton tall />}>
        <MudurHaftaWidget />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton />}>
        <MentorOzetiWidget />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton tall />}>
        <ZumreOgretmenWidget />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton tall />}>
        <AjandaSection />
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
            { href: '/siniflar',    label: 'Sınıf Listeleri',    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',     icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
            { href: '/yoklama',     label: 'Yoklama Girişi',     color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
            { href: '/raporlar',   label: 'Raporlar',            color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
            { href: '/ders-programi', label: 'Ders Programları', color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
            { href: '/siniflar',   label: 'Mentör Atamaları',    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
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
