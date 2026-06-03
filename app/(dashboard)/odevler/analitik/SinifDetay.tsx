import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'
import type { ClassStat, WeekBucket } from '@/src/domains/homework/lib/analitik'

type ClassStatWithMeta = ClassStat & { name: string; grade: number }

function barColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

function pctTextColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

export default function SinifDetay({
  classStats,
  weeklyTrend,
}: {
  classStats: ClassStatWithMeta[]
  weeklyTrend: WeekBucket[]
}) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Sınıf Bazlı Tamamlanma
      </h2>

      {classStats.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-8 text-center">
          <p className="text-sm text-gray-400 dark:text-slate-500">Henüz ödev atanmamış.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {classStats.map(cls => (
            <Link
              key={cls.classId}
              href={`/odevler/sinif/${cls.classId}`}
              className="block bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{cls.name}</span>
                <span className={`text-sm font-bold ${pctTextColor(cls.completionPct)}`}>%{cls.completionPct}</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor(cls.completionPct)}`} style={{ width: `${cls.completionPct}%` }} />
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                {cls.totalHomeworks} ödev · {cls.studentCount} öğrenci
              </p>
            </Link>
          ))}
        </div>
      )}

      {weeklyTrend.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Dönemlik Eğilim
          </h2>
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-end gap-2">
              {weeklyTrend.map(({ weekKey, pct }) => (
                <div key={weekKey} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">{pct}%</span>
                  <div className="w-full flex items-end" style={{ height: '60px' }}>
                    <div
                      className={`w-full rounded-t ${barColor(pct)}`}
                      style={{ height: `${Math.max(3, (pct / 100) * 60)}px` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 truncate w-full text-center">
                    {format(parseISO(weekKey), 'd MMM')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
