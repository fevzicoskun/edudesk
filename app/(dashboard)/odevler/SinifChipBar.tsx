import Link from 'next/link'

interface Props {
  classes: { id: string; name: string }[]
  activeByClass: Map<string, number>
  pendingByClass: Map<string, number>
}

export default function SinifChipBar({ classes, activeByClass, pendingByClass }: Props) {
  if (!classes.length) return null
  return (
    <div className="mt-4 mb-1">
      <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
        Başarı Haritası
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {classes.map(cls => {
          const activeCount  = activeByClass.get(cls.id) ?? 0
          const hasPending   = (pendingByClass.get(cls.id) ?? 0) > 0
          return (
            <Link
              key={cls.id}
              href={`/odevler/sinif/${cls.id}`}
              className={`flex items-center gap-1.5 shrink-0 bg-white dark:bg-slate-800 border rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                hasPending
                  ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:border-amber-400'
                  : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300'
              }`}
            >
              {hasPending ? (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              ) : (
                <svg className="w-3.5 h-3.5 opacity-40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" />
                </svg>
              )}
              {cls.name}
              {activeCount > 0 && (
                <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">{activeCount}</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
