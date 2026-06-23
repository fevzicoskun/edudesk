import { HomeworkSourceService } from '@/src/domains/homework/services/HomeworkSourceService'
import Link from 'next/link'

const THRESHOLDS = { warn: 7, alert: 14 } as const

function dayLabel(days: number | null): { text: string; cls: string } {
  if (days === null)                    return { text: 'Hiç kullanılmadı', cls: 'text-red-600 dark:text-red-400' }
  if (days === 0)                       return { text: 'Bugün kullanıldı',  cls: 'text-emerald-600 dark:text-emerald-400' }
  if (days <= THRESHOLDS.warn)          return { text: `${days} gün önce`,  cls: 'text-emerald-600 dark:text-emerald-400' }
  if (days <= THRESHOLDS.alert)         return { text: `${days} gün önce`,  cls: 'text-amber-600 dark:text-amber-400' }
  return                                       { text: `${days} gün önce`,  cls: 'text-red-600 dark:text-red-400' }
}

function urgencyBg(days: number | null): string {
  if (days === null || days > THRESHOLDS.alert) return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
  if (days > THRESHOLDS.warn)                  return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
  return                                               'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
}

export default async function KaynakTakibiWidget() {
  const { data } = await HomeworkSourceService.getSourceUsage()
  if (!data || data.length === 0) return null

  const hasAlert = data.some(s => s.daysSince === null || s.daysSince > THRESHOLDS.warn)

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Kaynak Takibi</h2>
          {hasAlert && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Bir süredir kullanılmayan kaynaklar var
            </p>
          )}
        </div>
        <Link
          href="/ayarlar#kaynaklar"
          className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
        >
          Yönet →
        </Link>
      </div>

      <div className="space-y-2">
        {data.map(s => {
          const lbl = dayLabel(s.daysSince)
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${urgencyBg(s.daysSince)}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{s.name}</p>
                {s.subject && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{s.subject}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {s.thisMonth > 0 && (
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">
                    Bu ay: {s.thisMonth}
                  </span>
                )}
                <span className={`text-xs font-medium ${lbl.cls}`}>{lbl.text}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
