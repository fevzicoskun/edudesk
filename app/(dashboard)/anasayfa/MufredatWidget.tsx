import Link from 'next/link'

type CurrRaw = { class_id: string; status: string; classes: { name: string; grade: number } | null }

export default function MufredatWidget({ curriculum }: { curriculum: CurrRaw[] }) {
  const byClass = new Map<string, { name: string; grade: number; total: number; done: number }>()
  for (const c of curriculum) {
    const cls = c.classes
    if (!cls) continue
    const prev = byClass.get(c.class_id) ?? { name: cls.name, grade: cls.grade, total: 0, done: 0 }
    prev.total++
    if (c.status === 'tamamlandi') prev.done++
    byClass.set(c.class_id, prev)
  }

  const rows = [...byClass.entries()]
    .map(([id, v]) => ({ id, ...v, pct: v.total ? Math.round((v.done / v.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct)

  const lowCount = rows.filter(r => r.pct < 60).length

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Müfredat Tamamlanma
          {lowCount > 0 && (
            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full">
              {lowCount} sınıf düşük
            </span>
          )}
        </h2>
        <Link href="/zumre?tab=mufredat" className="text-xs text-blue-600 font-medium hover:underline">Müfredat →</Link>
      </header>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-3">
            <span className={`text-xs font-medium w-16 shrink-0 ${r.pct < 60 ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-slate-300'}`}>
              {r.name}
            </span>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${r.pct < 60 ? 'bg-red-400' : r.pct < 80 ? 'bg-yellow-400' : 'bg-green-500'}`}
                style={{ width: `${r.pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400 w-10 text-right shrink-0">%{r.pct}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
