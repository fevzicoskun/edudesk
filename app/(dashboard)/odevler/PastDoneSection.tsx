import HomeworkCard from './HomeworkCard'
import SectionHeader from './SectionHeader'
import type { HW, StatusCounts } from './types'

export default function PastDoneSection({ pastDone, canWrite, statusMap, classStudentMap }: {
  pastDone: HW[]
  canWrite: boolean
  statusMap: Map<string, StatusCounts>
  classStudentMap: Map<string, number>
}) {
  let totalPossible = 0
  let totalYapildi  = 0
  for (const hw of pastDone) {
    const total  = classStudentMap.get(hw.class_id as string) ?? 0
    const counts = statusMap.get(hw.id)
    totalPossible += total
    totalYapildi  += counts?.yapildi ?? 0
  }
  const avgPct = totalPossible > 0 ? Math.round((totalYapildi / totalPossible) * 100) : null

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <SectionHeader label="Geçmiş" count={pastDone.length} color="bg-slate-300 dark:bg-slate-600" />
        {avgPct !== null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            avgPct >= 75
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : avgPct >= 50
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            Ort. %{avgPct} tamamlandı
          </span>
        )}
      </div>
      <div className="space-y-3 opacity-80">
        {pastDone.map(hw => <HomeworkCard key={hw.id} hw={hw} overdue={true} canWrite={canWrite} statusMap={statusMap} classStudentMap={classStudentMap} />)}
      </div>
    </section>
  )
}
