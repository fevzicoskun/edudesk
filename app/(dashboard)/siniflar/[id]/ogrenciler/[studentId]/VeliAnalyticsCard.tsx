import { VeliAnalyticsRepository } from '@/src/domains/classes/repositories/VeliAnalyticsRepository'
import { format, parseISO } from '@/src/shared/date'

const SECTION_LABELS: Record<string, string> = {
  odevler:    'Ödevler',
  devamsizlik: 'Devamsızlık',
  notlar:     'Notlar',
}

const ALL_SECTIONS = ['odevler', 'devamsizlik', 'notlar'] as const

interface Props { studentId: string; schoolId: string }

export default async function VeliAnalyticsCard({ studentId, schoolId }: Props) {
  const analytics = await VeliAnalyticsRepository.getVeliAnalytics(studentId, schoolId)

  if (!analytics || analytics.totalViews === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Veli Portal Aktivitesi</h2>
        <p className="text-sm text-gray-400 dark:text-slate-500">Veli henüz portalı açmamış.</p>
      </div>
    )
  }

  const durationMin = Math.round(analytics.totalDurationSec / 60)
  const lastViewed  = analytics.lastViewedAt
    ? format(parseISO(analytics.lastViewedAt), 'd MMM yyyy')
    : null

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Veli Portal Aktivitesi</h2>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{analytics.totalViews}</p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Ziyaret</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
            {durationMin > 0 ? `~${durationMin}` : '<1'}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Dakika</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{lastViewed ?? '—'}</p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Son Ziyaret</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_SECTIONS.map(s => (
          <span
            key={s}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              analytics.sections.includes(s)
                ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                : 'bg-gray-50 text-gray-300 border-gray-100 dark:bg-slate-700 dark:text-slate-500 dark:border-slate-600'
            }`}
          >
            {analytics.sections.includes(s) ? '✓ ' : ''}{SECTION_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  )
}
