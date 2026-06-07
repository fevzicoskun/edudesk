interface Props {
  activeCount: number
  pendingCount: number
}

export default function HomeworkStatCards({ activeCount, pendingCount }: Props) {
  const cards = [
    { label: 'Aktif Ödev',       value: activeCount,  color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
    { label: 'Kontrol Bekliyor', value: pendingCount, color: 'text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500'  },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 mb-6 mt-4">
      {cards.map(({ label, value, color, dot }) => (
        <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3.5 shadow-sm flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <div>
            <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
