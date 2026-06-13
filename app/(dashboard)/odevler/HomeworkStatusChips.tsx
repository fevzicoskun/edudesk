type StatusCounts = { yapildi: number; eksik: number; yapilmadi: number; gec: number; mazeretli: number }

const CHIP_STYLES: Record<keyof StatusCounts, string> = {
  yapildi:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  yapilmadi: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  eksik:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  gec:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  mazeretli: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

const CHIP_LABELS: Record<keyof StatusCounts, string> = {
  yapildi:   'Yapıldı',
  yapilmadi: 'Yapılmadı',
  eksik:     'Eksik',
  gec:       'Geç',
  mazeretli: 'Mazeretli',
}

const CHIP_ORDER: (keyof StatusCounts)[] = ['yapildi', 'yapilmadi', 'eksik', 'gec', 'mazeretli']

export default function HomeworkStatusChips({
  statusCounts, totalStu, allEntered, unrecorded,
}: {
  statusCounts?: StatusCounts
  totalStu: number
  allEntered: boolean
  unrecorded: number
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-3">
      {allEntered ? (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
          ✓ Tümü girildi ({totalStu} öğrenci)
        </span>
      ) : (
        <>
          {CHIP_ORDER.map(key => {
            const count = statusCounts?.[key] ?? 0
            if (count === 0) return null
            return (
              <span key={key} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CHIP_STYLES[key]}`}>
                {count} {CHIP_LABELS[key]}
              </span>
            )
          })}
          {unrecorded > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500">
              {unrecorded} girilmedi
            </span>
          )}
        </>
      )}
    </div>
  )
}
