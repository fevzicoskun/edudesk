'use client'

import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import type { SubmissionStatus } from '@/src/shared/types'

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const DAYS   = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']

function dayLabel(dateStr: string): string {
  try {
    const [y, m, day] = dateStr.split('-').map(Number)
    const d = new Date(y, m - 1, day)
    return `${d.getDate()} ${MONTHS[d.getMonth()]} (${DAYS[d.getDay()]})`
  } catch { return dateStr }
}

export function WeekLoadBadge({
  load,
  open,
  onToggle,
}: {
  load:     ClassWeekLoad
  open:     boolean
  onToggle: () => void
}) {
  const badgeCls =
    load.level === 'danger'
      ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800'
      : load.level === 'warn'
        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400 border-gray-200 dark:border-slate-600'

  return (
    <div className="relative z-20">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggle() }}
        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border min-h-[44px] transition-colors ${badgeCls}`}
      >
        ● {load.count} ödev
      </button>
      {open && <WeekLoadPopover load={load} />}
    </div>
  )
}

export function WeekLoadPopover({ load }: { load: ClassWeekLoad }) {
  return (
    <div className="absolute left-0 top-7 z-30 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-3 space-y-2">
      <p className={`text-xs font-semibold ${
        load.level === 'danger' ? 'text-red-600 dark:text-red-400' :
        load.level === 'warn'   ? 'text-amber-600 dark:text-amber-400' :
                                   'text-gray-600 dark:text-slate-400'
      }`}>
        Bu hafta {load.count} ödev
      </p>
      <div className="space-y-1.5">
        {load.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`shrink-0 mt-0.5 text-[10px] font-bold ${item.isOwn ? 'text-blue-500' : 'text-gray-400 dark:text-slate-500'}`}>
              {item.isOwn ? '★' : '·'}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-gray-800 dark:text-slate-200 leading-snug truncate">{item.subject}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">
                {dayLabel(item.dueDate)}
                {!item.isOwn && ` · ${item.teacherName}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
