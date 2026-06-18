import type { CoverageStat } from '@/src/domains/attendance/lib/analitik'

export default function SinifKapsama({ items }: { items: CoverageStat[] }) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Sınıf Yoklama Kapsaması (son 30 gün)</h2>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">Okul günlerinin yüzde kaçında yoklama girildi.</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Veri yok.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(c => {
            const tone = c.coveragePct < 60 ? 'bg-rose-500' : c.coveragePct < 85 ? 'bg-amber-400' : 'bg-emerald-400'
            return (
              <li key={c.classId} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-16 shrink-0">{c.name}</span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${c.coveragePct}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-600 dark:text-slate-300 w-12 text-right shrink-0">%{c.coveragePct}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
