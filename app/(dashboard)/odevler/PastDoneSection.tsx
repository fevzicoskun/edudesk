import HomeworkCard from './HomeworkCard'
import { LISTE } from './SectionHeader'
import type { HW, StatusCounts } from './types'

export default function PastDoneSection({ pastDone, canWrite, userId, statusMap, classStudentMap }: {
  pastDone: HW[]
  canWrite: boolean
  userId: string
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

  // Varsayılan kapalı: biten ödevler listeyi kalabalıklaştırıyordu; açınca hepsi görünür
  return (
    <details className="group">
      <summary className="flex items-center justify-between gap-2 mb-2 px-1 cursor-pointer list-none select-none">
        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          <span className="inline-block mr-1 text-gray-400 transition-transform group-open:rotate-90" aria-hidden>›</span>
          Geçmiş <span className="font-normal text-gray-500 dark:text-slate-400">· {pastDone.length}</span>
        </span>
        {avgPct !== null && (
          <span className="text-xs text-gray-500 dark:text-slate-400">ortalama %{avgPct} yapıldı</span>
        )}
      </summary>
      <div className={LISTE}>
        {pastDone.map(hw => <HomeworkCard key={hw.id} hw={hw} overdue={true} canWrite={canWrite && hw.teacher_id === userId} userId={userId} statusMap={statusMap} classStudentMap={classStudentMap} />)}
      </div>
    </details>
  )
}
