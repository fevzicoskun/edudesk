import Link from 'next/link'
import SectionHeader from './SectionHeader'

type StatusCounts = { yapildi: number; eksik: number; yapilmadi: number; gec: number; mazeretli: number }

interface Homework {
  id: string
  title: string
  due_date: string | null
  class_id: unknown
  classes: { name: string } | null
}

interface Props {
  pendingCheck: Homework[]
  statusMap: Map<string, StatusCounts>
  classStudentMap: Map<string, number>
  now: Date
}

function dueDateStr(due: string | null): string {
  if (!due) return '—'
  try {
    const d = new Date(due + 'T12:00:00')
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  } catch { return due }
}

function daysSinceDue(due: string | null, now: Date): number {
  if (!due) return 0
  return Math.floor((now.getTime() - new Date(due).getTime()) / 86_400_000)
}

export default function BekleyenKontrollerPanel({ pendingCheck, statusMap, classStudentMap, now }: Props) {
  if (!pendingCheck.length) return null
  return (
    <section>
      <SectionHeader label="Kontrol bekliyor" count={pendingCheck.length}>
        <span className="text-xs text-gray-500 dark:text-slate-400">son tarihi geçti, işaretlenmedi</span>
      </SectionHeader>
      <div className="bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/60">
        {pendingCheck.map(hw => {
          const days    = daysSinceDue(hw.due_date, now)
          const counts  = statusMap.get(hw.id)
          const checked = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
          const total   = classStudentMap.get(hw.class_id as string) ?? 0
          const progressLabel = total > 0
            ? `${checked}/${total} girildi`
            : checked === 0 ? 'Hiç girilmedi' : `${checked} girildi`
          return (
            <Link
              key={hw.id}
              href={`/odevler/${hw.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 line-clamp-2">
                  {hw.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-1.5">
                  <span className="whitespace-nowrap">{hw.classes?.name ?? '—'} · {dueDateStr(hw.due_date)}</span>
                  <span className="whitespace-nowrap">· {progressLabel}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  days > 7
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>
                  {days === 0 ? 'Bugün bitti' : `${days}g önce`}
                </span>
                <svg className="w-4 h-4 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
