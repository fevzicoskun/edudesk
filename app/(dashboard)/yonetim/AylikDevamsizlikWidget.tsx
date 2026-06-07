import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { format } from '@/src/shared/date'
import Link from 'next/link'

export default async function AylikDevamsizlikWidget() {
  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const today     = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

  const { data } = await supabase
    .from('attendance')
    .select('class_id, classes(name)')
    .eq('school_id', school_id)
    .gte('date', monthStart)
    .lte('date', todayStr)
    .eq('status', 'absent')

  type Row = { class_id: string; classes: { name: string } | null }
  const rows = (data ?? []) as unknown as Row[]

  const byClass = new Map<string, { name: string; count: number }>()
  for (const row of rows) {
    const key = row.class_id
    if (!byClass.has(key)) byClass.set(key, { name: row.classes?.name ?? '?', count: 0 })
    byClass.get(key)!.count++
  }

  const sorted  = [...byClass.values()].sort((a, b) => b.count - a.count)
  const total   = sorted.reduce((s, c) => s + c.count, 0)
  const maxCount = sorted[0]?.count ?? 1

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bu Ay Devamsızlık</h2>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
            {format(new Date(today.getFullYear(), today.getMonth(), 1), 'd MMM')} – {format(today, 'd MMM')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs text-gray-400 dark:text-slate-500">Toplam: {total}</span>
          )}
          <Link
            href="/yonetim/devamsizlar"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Bugün →
          </Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
          Bu ay devamsızlık kaydı yok.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map(c => {
            const pct  = Math.round((c.count / maxCount) * 100)
            const bar  = c.count >= 10 ? 'bg-red-500' : c.count >= 5 ? 'bg-amber-400' : 'bg-blue-400'
            const text = c.count >= 10
              ? 'text-red-600 dark:text-red-400'
              : c.count >= 5
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-700 dark:text-slate-300'
            return (
              <li key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{c.name}</span>
                  <span className={`text-xs font-bold tabular-nums ${text}`}>{c.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-700">
                  <div className={`h-1.5 rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
