import Link from 'next/link'

type HwItem = { id: string; title: string; subject: string | null; classes: { name: string } | null }

const CLASS_COLORS = [
  'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-teal-100   text-teal-700   dark:bg-teal-900/40   dark:text-teal-300',
  'bg-pink-100   text-pink-700   dark:bg-pink-900/40   dark:text-pink-300',
  'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  'bg-cyan-100   text-cyan-700   dark:bg-cyan-900/40   dark:text-cyan-300',
  'bg-rose-100   text-rose-700   dark:bg-rose-900/40   dark:text-rose-300',
  'bg-lime-100   text-lime-700   dark:bg-lime-900/40   dark:text-lime-300',
]

function classColor(name: string | null | undefined): string {
  if (!name) return CLASS_COLORS[0]
  let h = 5381
  for (const c of name) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0
  return CLASS_COLORS[h % CLASS_COLORS.length]
}

export default function CalendarEventCard({
  hw,
  completionInfo,
}: {
  hw: HwItem
  completionInfo?: { yapildi: number; total: number }
}) {
  return (
    <li>
      <Link
        href={`/odevler/${hw.id}`}
        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group"
      >
        <span className={`mt-1 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${classColor(hw.classes?.name)}`}>
          {hw.classes?.name ?? '—'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
            {hw.title}
          </p>
          {hw.subject && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{hw.subject}</p>
          )}
          {completionInfo && completionInfo.total > 0 && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              %{Math.round((completionInfo.yapildi / completionInfo.total) * 100)} tamamlandı
              ({completionInfo.yapildi}/{completionInfo.total})
            </p>
          )}
        </div>
        <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  )
}
