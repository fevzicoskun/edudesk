import { Suspense } from 'react'
import Link from 'next/link'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { format, parseISO, todayLocalISO } from '@/src/shared/date'
import OgretmenDashboard     from './OgretmenDashboard'
import WidgetErrorBoundary from './WidgetErrorBoundary'
import MYStatsWidget          from './MYStatsWidget'
import DevamsizlikRiskiWidget from './DevamsizlikRiskiWidget'
import { BugunBolumu, OdevBolumu, OgretmenBolumu, MentorlukBolumu } from './YoneticiBolumleri'
import KarneIndirButton from '../yonetim/KarneIndirButton'
import UyariBandi from '../yonetim/UyariBandi'
import BugunYoklamaWidget from '../yonetim/BugunYoklamaWidget'
import AylikDevamsizlikWidget from '../yonetim/AylikDevamsizlikWidget'
import { okulYoklamaAktif } from '@/src/domains/school/okulYoklama'
import { getGreeting }        from '@/src/shared/utils'
import { createClient } from '@/src/infrastructure/supabase/server'
import { firstRunState } from '@/src/domains/dashboard/lib/firstRun'
import { KurulumWidget } from './IlkAdimlarWidget'
import BaslangicKartiMudur from './BaslangicKartiMudur'
import { SetupService } from '@/src/domains/onboarding/services/SetupService'
import MudurTrendWidget from './MudurTrendWidget'
import ErkenUyarilarWidget from './ErkenUyarilarWidget'

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

const baglanti = 'px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'

/** MY ve müdür aynı sayfa (spec 2026-10-10); eski Okul Durumu buraya katıldı. Müdürde altta trendler. */
async function YoneticiWidgets({ fullName, classCount, mudur }: { fullName: string; classCount: number; mudur: boolean }) {
  const [setup, yoklama] = await Promise.all([
    mudur ? SetupService.getSetupStatus() : null,
    requireSchoolId().then(okulYoklamaAktif),
  ])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{getGreeting(fullName)}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {format(parseISO(todayLocalISO()), 'd MMMM yyyy, EEEE')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/kullanicilar" className={baglanti}>Kullanıcılar</Link>
          <Link href="/yonetim/ogrenciler" className={baglanti}>Öğrenciler</Link>
          <KarneIndirButton />
          <Link href="/yonetim/odevler" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            Ödev Takibi →
          </Link>
        </div>
      </div>

      {setup?.kind === 'mudur'
        ? <BaslangicKartiMudur code={setup.code} />
        : firstRunState(mudur ? 'mudur' : 'mudur_yardimcisi', classCount) === 'setup' && <KurulumWidget />}

      <Suspense fallback={<><WidgetSkeleton /><WidgetSkeleton /></>}>
        <MYStatsWidget />
      </Suspense>
      <Suspense fallback={null}>
        <UyariBandi />
      </Suspense>

      {([
        ['Bugün', BugunBolumu],
        ['Ödev durumu', OdevBolumu],
        ['Öğretmen takibi', OgretmenBolumu],
        ['Mentörlük ve veli', MentorlukBolumu],
      ] as const).map(([ad, Bolum]) => (
        <Suspense key={ad} fallback={<WidgetSkeleton tall />}>
          <WidgetErrorBoundary label={ad}>
            <Bolum />
          </WidgetErrorBoundary>
        </Suspense>
      ))}

      {yoklama && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Suspense fallback={<WidgetSkeleton tall />}><BugunYoklamaWidget /></Suspense>
          <Suspense fallback={<WidgetSkeleton tall />}><AylikDevamsizlikWidget /></Suspense>
          <Suspense fallback={<WidgetSkeleton tall />}><DevamsizlikRiskiWidget /></Suspense>
        </div>
      )}

      <Suspense fallback={<WidgetSkeleton tall />}>
        <WidgetErrorBoundary label="Erken uyarılar">
          <ErkenUyarilarWidget />
        </WidgetErrorBoundary>
      </Suspense>

      {mudur && (
        <Suspense fallback={<><WidgetSkeleton tall /><WidgetSkeleton tall /></>}>
          <WidgetErrorBoundary label="Okul trendleri">
            <MudurTrendWidget />
          </WidgetErrorBoundary>
        </Suspense>
      )}
    </div>
  )
}

export const metadata = { title: 'Anasayfa' }

export default async function AnasayfaPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const fullName = profile.full_name ?? ''

  if (profile.role === 'mudur' || profile.role === 'mudur_yardimcisi') {
    const supabase = await createClient()
    const { count } = await supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', profile.school_id!)
      .is('deleted_at', null)
    const classCount = count ?? 0
    return <YoneticiWidgets fullName={fullName} classCount={classCount} mudur={profile.role === 'mudur'} />
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <OgretmenDashboard />
    </Suspense>
  )
}
