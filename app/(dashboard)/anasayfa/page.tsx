import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/lib/auth'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import CalendarWidget from './CalendarWidget'
import SubmissionsPanel, { SubmissionsPanelSkeleton } from './SubmissionsPanel'

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
type Tone = 'blue' | 'indigo'

export default async function AnasayfaPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user) return null

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

  const { data: hwData } = await hwQuery
  const homeworks = (hwData ?? []) as unknown as HwLite[]
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

      {/* Hemen gösterilen özet kartları (sadece homeworks lazım) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Bugünkü ödev" value={todayHws.length} tone="blue" />
        <SummaryCard label="Yaklaşan (7 gün)" value={upcomingHws.length} tone="indigo" />
      </div>

      {/* Hemen görünen: bugün/yaklaşan listesi + takvim */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
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
                        try { return format(parseISO(hw.due_date), 'd MMM', { locale: tr }) }
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

      {/* Streamed: eksik/yapılmadı sayıları + takip listesi + sınıf özeti */}
      <Suspense fallback={<SubmissionsPanelSkeleton />}>
        <SubmissionsPanel hwIds={hwIds} homeworks={homeworks} />
      </Suspense>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const TONE: Record<Tone, string> = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  }
  return (
    <div className={`border rounded-xl p-3 ${TONE[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-90">{label}</p>
    </div>
  )
}
