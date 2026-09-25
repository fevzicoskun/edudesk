export default function SectionHeader({ label, count, children }: { label: string; count: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 px-1">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
        {label} <span className="font-normal text-gray-500 dark:text-slate-400">· {count}</span>
      </h2>
      {children}
    </div>
  )
}

/** Liste kutusu — üç bölüm (kontrol bekliyor / aktif / geçmiş) aynı görünür */
export const LISTE = 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/60'
