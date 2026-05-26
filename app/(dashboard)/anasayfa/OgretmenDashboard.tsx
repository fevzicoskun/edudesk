import { Suspense } from 'react'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { addDays, format, parseISO } from '@/src/shared/date'
import CalendarWidget from './CalendarWidget'
import RiskUyarilariWidget from './RiskUyarilariWidget'
import { TeacherDashboardService } from '@/src/domains/dashboard/services/TeacherDashboardService'

type Tone = 'blue' | 'orange' | 'rose'
const TONE: Record<Tone, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
  rose:   'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className={`border rounded-xl p-4 ${TONE[tone]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-90">{label}</p>
    </div>
  )
}

function RiskSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      {[0, 1, 2].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-700/50 rounded-lg" />)}
    </div>
  )
}

export default async function OgretmenDashboard() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) redirect('/login')

  const metrics = await TeacherDashboardService.getDashboardMetrics(user.id)

  void TeacherDashboardService.logActivity(user.id, 'dashboard_view').catch(() => {})

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const next7Str = addDays(today, 7).toISOString().split('T')[0]

  const todayHws = metrics.homeworks.filter(h => h.due_date === todayStr)
  const upcomingHws = metrics.homeworks
    .filter(h => h.due_date > todayStr && h.due_date <= next7Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Anasayfa</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Merhaba {profile.full_name ?? ''} · hızlı özet aşağıda.
        </p>
      </div>

      {/* 3 Ana Kart */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <SummaryCard label="Bugünkü ödev"   value={metrics.todayHomeworkCount} tone="blue" />
        <SummaryCard label="Toplam eksik"   value={metrics.totalMissingCount}  tone="orange" />
        <SummaryCard label="Aktif risk"     value={metrics.activeRiskCount}    tone="rose" />
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
            <p className="text-sm font-bold text-rose-600">{metrics.weekly.newRiskCount}</p>
            <p className="text-[10px] text-gray-400">Yeni risk</p>
          </div>
        </div>
      </div>

      {/* Alt Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          {/* Bugün ve Yaklaşan */}
          <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
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
                  ...todayHws.map(h => ({ ...h, isToday: true })),
                  ...upcomingHws.map(h => ({ ...h, isToday: false })),
                ].map(hw => (
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

          {/* Risk Uyarıları */}
          <Suspense fallback={<RiskSkeleton />}>
            <RiskUyarilariWidget />
          </Suspense>
        </section>

        {/* Takvim */}
        <div className="space-y-4">
          <CalendarWidget homeworks={metrics.homeworks} />
        </div>
      </div>
    </div>
  )
}
