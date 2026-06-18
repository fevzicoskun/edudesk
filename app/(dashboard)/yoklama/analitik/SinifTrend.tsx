import type { ClassAbsenceStat, WeeklyAbsencePoint } from '@/src/domains/attendance/lib/analitik'

export default function SinifTrend({ classStats, trend }: { classStats: ClassAbsenceStat[]; trend: WeeklyAbsencePoint[] }) {
  const maxAvg = Math.max(1, ...classStats.map(c => c.avgUnexcused))
  const maxRate = Math.max(1, ...trend.map(t => t.rate))
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Sınıf Karşılaştırma</h2>
      {classStats.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Veri yok.</p>
      ) : (
        <ul className="space-y-2 mb-5">
          {classStats.map(c => (
            <li key={c.classId} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-16 shrink-0">{c.name}</span>
              <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.round((c.avgUnexcused / maxAvg) * 100)}%` }} />
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400 w-28 text-right shrink-0">ort. {c.avgUnexcused.toFixed(1)} gün/öğrenci</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Haftalık Devamsızlık Trendi (son 8 hafta)</h2>
      <div className="flex items-end gap-1.5 h-24">
        {trend.map(t => (
          <div key={t.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${t.weekStart}: %${t.rate}`}>
            <div className="w-full rounded-t bg-blue-400 dark:bg-blue-500" style={{ height: `${Math.max(4, Math.round((t.rate / maxRate) * 100))}%` }} />
            <span className="text-[10px] text-gray-400 dark:text-slate-500">%{t.rate}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
