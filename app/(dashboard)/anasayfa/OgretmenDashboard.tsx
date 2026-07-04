import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { addDays, format, parseISO } from '@/src/shared/date'
import { isYoklamaTimeLocked } from '@/src/shared/constants/attendance'
import { getGreeting } from '@/src/shared/utils'
import RiskUyarilariWidget from './RiskUyarilariWidget'
import OdevTamamlanmaWidget from './OdevTamamlanmaWidget'
import { TeacherDashboardService } from '@/src/domains/dashboard/services/TeacherDashboardService'
import { DutyService } from '@/src/domains/schedule/services/DutyService'
import BugunYapilacaklarWidget from './BugunYapilacaklarWidget'
import BugunProgramWidget from './BugunProgramWidget'
import OdevCockpit from './OdevCockpit'
import HizliAksiyonlar from './HizliAksiyonlar'
import Yapilacaklarim from './Yapilacaklarim'
import { TaskService } from '@/src/domains/tasks/services/TaskService'
import { createClient } from '@/src/infrastructure/supabase/server'
import { firstRunState, type Role } from '@/src/domains/dashboard/lib/firstRun'
import { BeklemeWidget } from './IlkAdimlarWidget'
import BaslangicKartiOgretmen from './BaslangicKartiOgretmen'
import { SetupService } from '@/src/domains/onboarding/services/SetupService'

type Tone = 'blue' | 'orange' | 'rose'
const TONE: Record<Tone, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
  rose:   'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
}

const DUTY_DAYS: Record<number, string> = { 1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba', 4: 'Perşembe', 5: 'Cuma' }

type DutyLite = { day_of_week: number; time_range: string; location: string; notes?: string | null }

// Öğretmenin nöbet şeridi. Bugün nöbeti varsa amber + "BUGÜN"; yoksa tüm nöbetler nötr listelenir.
function NobetBanner({ duties, todayDow }: { duties: DutyLite[]; todayDow: number }) {
  const bugunkuler = duties.filter(d => d.day_of_week === todayDow)
  const bugun = bugunkuler.length > 0
  // Bugün nöbet varsa yalnızca bugünküleri öne çıkar; yoksa tüm nöbetleri göster.
  const goster = bugun ? bugunkuler : duties
  const sirali = [...goster].sort((a, b) => a.day_of_week - b.day_of_week)

  return (
    <Link
      href="/ders-programi"
      className={`flex items-start gap-2 flex-wrap rounded-xl border px-4 py-3 mb-4 text-sm transition-opacity hover:opacity-80 ${
        bugun
          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
          : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
      }`}
    >
      <span aria-hidden>🔔</span>
      <span className="font-semibold whitespace-nowrap">{bugun ? 'Bugün nöbet:' : 'Nöbetlerin:'}</span>
      <span className="flex flex-col gap-0.5">
        {sirali.map((d, i) => (
          <span key={i}>
            {DUTY_DAYS[d.day_of_week] ?? '—'} · {d.time_range} · {d.location}
            {d.notes ? <span className="text-xs opacity-80"> ({d.notes})</span> : null}
          </span>
        ))}
      </span>
      {bugun && (
        <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">BUGÜN</span>
      )}
    </Link>
  )
}

function SummaryCard({ label, value, tone, href }: { label: string; value: number; tone: Tone; href?: string }) {
  const cls = `border rounded-xl p-4 transition-opacity ${TONE[tone]} ${href ? 'hover:opacity-80 cursor-pointer' : ''}`
  const inner = (
    <>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-90">{label}</p>
    </>
  )
  if (href) return <Link href={href} className={cls}>{inner}</Link>
  return <div className={cls}>{inner}</div>
}


export default async function OgretmenDashboard() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) redirect('/login')

  void TeacherDashboardService.logActivity(user.id, 'dashboard_view').catch(() => {})

  const [metrics, duties, myTasks] = await Promise.all([
    TeacherDashboardService.getDashboardMetrics(user.id),
    DutyService.getMyDuties(),
    TaskService.getMyActiveTasks(),
  ])

  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const next7Str = addDays(today, 7).toISOString().split('T')[0]

  const greeting = getGreeting(profile.full_name ?? '')

  // İlk-kullanım: ATANMIŞ sınıf (teacher_classes) yoksa sade bekleme ekranı göster.
  // Not: ödev-türevli yoklamaDurumu DEĞİL — ödevi olmayan ama sınıfı olan öğretmen yanlış ekran görmesin.
  const supabaseTc = await createClient()
  const { count: assignedClassCount } = await supabaseTc
    .from('teacher_classes')
    .select('class_id', { count: 'exact', head: true })
    .eq('teacher_id', profile.id)
  if (firstRunState(profile.role as Role, assignedClassCount ?? 0) === 'waiting') {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{greeting}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{format(today, 'd MMMM yyyy, EEEE')}</p>
        </div>
        <BeklemeWidget />
      </div>
    )
  }

  // Öğretmen 10:30'dan sonra bugünün yoklamasını düzenleyemez; CTA bunu yansıtmalı.
  const canEditAfterLock = ['mudur_yardimcisi', 'mudur', 'admin'].includes(profile.role)
  const yoklamaLocked = !canEditAfterLock && isYoklamaTimeLocked(today)

  const todayHws = metrics.homeworks.filter(h => h.due_date === todayStr)
  const upcomingHws = metrics.homeworks
    .filter(h => h.due_date > todayStr && h.due_date <= next7Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const setup = await SetupService.getSetupStatus()

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{greeting}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {format(today, 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {/* Başlangıç kartı — ilk 30 gün + eksik kurulum adımı varsa */}
      {setup?.kind === 'ogretmen' && <BaslangicKartiOgretmen steps={setup.steps} />}

      {/* Bugünkü ders programı şeridi (program kuruluysa kendini gösterir) */}
      <Suspense fallback={null}>
        <BugunProgramWidget />
      </Suspense>

      {/* Nöbet şeridi (kayıtlıysa) */}
      {duties.length > 0 && <NobetBanner duties={duties} todayDow={today.getDay()} />}

      {/* Hızlı Aksiyonlar */}
      <HizliAksiyonlar
        yoklamaDurumu={metrics.yoklamaDurumu}
        bugunHwSayisi={todayHws.length}
        yoklamaLocked={yoklamaLocked}
      />

      {/* Yapılacaklarım — kişisel aksiyon katmanı */}
      <Yapilacaklarim initial={myTasks} />

      {/* Gecikmiş Ödev Uyarısı */}
      <Suspense fallback={null}>
        <OdevCockpit schoolId={profile.school_id ?? ''} />
      </Suspense>

      {/* Bugün Yapılacaklar */}
      <BugunYapilacaklarWidget
        yoklamaDurumu={metrics.yoklamaDurumu}
        todayHomeworks={todayHws}
        activeRiskCount={metrics.activeRiskCount}
        hasClasses={metrics.yoklamaDurumu.length > 0}
      />

      {/* 3 Ana Kart */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <SummaryCard label="Bugünkü ödev"   value={metrics.todayHomeworkCount} tone="blue"   href="/odevler" />
        <SummaryCard label="Toplam eksik"   value={metrics.totalMissingCount}  tone="orange" href="/odevler?durum=yapilmadi" />
        <SummaryCard label="Aktif risk"     value={metrics.activeRiskCount}    tone="rose"   href="#risk-uyarilari" />
      </div>

      {/* Haftalık Özet Şeridi */}
      <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Bu Hafta</span>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{metrics.weekly.submittedCount}</p>
            <p className="text-[10px] text-gray-400">Teslim edilen</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">%{metrics.weekly.avgCompletionPct}</p>
            <p className="text-[10px] text-gray-400">Ort. tamamlanma</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-rose-600">{metrics.weekly.activeRiskCount}</p>
            <p className="text-[10px] text-gray-400">Aktif risk</p>
          </div>
        </div>
      </div>

      {/* Ödev Tamamlanma Widget */}
      <div className="mb-4">
        <OdevTamamlanmaWidget data={metrics.tamamlanmaData} />
      </div>

      {/* Alt Bölüm */}
      <div className="space-y-4">
        {/* Yaklaşan Ödevler */}
        {upcomingHws.length > 0 && (
          <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Yaklaşan Ödevler</h2>
              <div className="flex items-center gap-3">
                <Link href="/odevler/takvim" className="text-xs text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Takvim →
                </Link>
                <Link href="/odevler" className="text-xs text-blue-600 font-medium hover:underline">Tümü →</Link>
              </div>
            </header>
            <ul className="space-y-2">
              {upcomingHws.map(hw => (
                <li key={hw.id}>
                  <Link
                    href={`/odevler/${hw.id}`}
                    className="block rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{hw.title}</span>
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
          </section>
        )}

        {/* Risk Uyarıları */}
        <div id="risk-uyarilari">
          <RiskUyarilariWidget alerts={metrics.riskAlerts} />
        </div>
      </div>
    </div>
  )
}
