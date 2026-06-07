import Link from 'next/link'

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
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return due }
}

function daysSinceDue(due: string | null, now: Date): number {
  if (!due) return 0
  return Math.floor((now.getTime() - new Date(due).getTime()) / 86_400_000)
}

export default function BekleyenKontrollerPanel({ pendingCheck, statusMap, classStudentMap, now }: Props) {
  if (!pendingCheck.length) return null
  return (
    <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-amber-200 dark:border-amber-800/60">
        <div className="w-7 h-7 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {pendingCheck.length} ödev kontrol bekliyor
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
            Son tarihi geçti ve öğrencilerin yarısından azı girildi.
          </p>
        </div>
      </div>
      <div className="divide-y divide-amber-100 dark:divide-amber-900/40">
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
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                  {hw.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {hw.classes?.name ?? '—'} · Son: {dueDateStr(hw.due_date)} · {progressLabel}
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
                <svg className="w-4 h-4 text-amber-400 dark:text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
