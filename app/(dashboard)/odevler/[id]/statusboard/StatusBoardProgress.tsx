import type { SubmissionStatus } from '@/src/shared/types'
import { WeekLoadBadge } from '@/components/homework/WeekLoadBadge'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import { STATUS_OPTIONS, LABELS, BAR_COLORS } from './types'

type Props = {
  recordedCount: number
  totalStudents: number
  counts: Record<SubmissionStatus, number>
  weekLoad: ClassWeekLoad | null
  openBadge: boolean
  onToggleBadge: () => void
}

export default function StatusBoardProgress({
  recordedCount,
  totalStudents,
  counts,
  weekLoad,
  openBadge,
  onToggleBadge,
}: Props) {
  const progressPct    = totalStudents === 0 ? 0 : Math.round(recordedCount / totalStudents * 100)
  const pct = (n: number) => totalStudents === 0 ? 0 : (n / totalStudents) * 100
  const unrecordedCount = Math.max(0, totalStudents - recordedCount)

  return (
    <div className="mb-5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-semibold text-gray-600 dark:text-slate-400">
          {recordedCount}/{totalStudents} öğrenci işaretlendi
        </span>
        <div className="flex items-center gap-2">
          {weekLoad && weekLoad.count > 0 && (
            <WeekLoadBadge load={weekLoad} open={openBadge} onToggle={onToggleBadge} />
          )}
          <span className={`font-bold text-base ${progressPct === 100 ? 'text-emerald-600' : progressPct >= 60 ? 'text-amber-600' : 'text-gray-400'}`}>
            %{progressPct}
          </span>
        </div>
      </div>
      {/* Segmented bar */}
      <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${pct(counts.yapildi)}%` }} />
        <div className="bg-orange-400  h-full transition-all duration-500" style={{ width: `${pct(counts.gec)}%` }} />
        <div className="bg-amber-400   h-full transition-all duration-500" style={{ width: `${pct(counts.eksik)}%` }} />
        <div className="bg-red-400     h-full transition-all duration-500" style={{ width: `${pct(Math.max(0, counts.yapilmadi - unrecordedCount))}%` }} />
        <div className="bg-slate-300   h-full transition-all duration-500" style={{ width: `${pct(counts.mazeretli)}%` }} />
      </div>
      {/* Sayım satırı */}
      <div className="flex flex-wrap gap-3 mt-2.5">
        {STATUS_OPTIONS.map(s => (
          <span key={s} className="flex items-center gap-1 text-xs">
            <span className={`w-2 h-2 rounded-full ${BAR_COLORS[s]}`} />
            <span className="text-gray-500 dark:text-slate-400">{LABELS[s]}: <strong className="text-gray-800 dark:text-slate-200">{counts[s]}</strong></span>
          </span>
        ))}
        {unrecordedCount > 0 && (
          <span className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-slate-600" />
            <span className="text-gray-500 dark:text-slate-400">Girilmedi: <strong>{unrecordedCount}</strong></span>
          </span>
        )}
      </div>
    </div>
  )
}
