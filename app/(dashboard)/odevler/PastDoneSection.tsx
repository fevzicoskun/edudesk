import HomeworkCard from './HomeworkCard'
import SectionHeader from './SectionHeader'
import type { HW, StatusCounts } from './types'
import { oran } from '@/src/domains/homework/lib/analitik'

export default function PastDoneSection({ pastDone, canWrite, userId, statusMap, classStudentMap }: {
  pastDone: HW[]
  canWrite: boolean
  userId: string
  statusMap: Map<string, StatusCounts>
  classStudentMap: Map<string, number>
}) {
  // Ortalama tek tanımla (oran): yapıldı / (işaretli − mazeretli); işaretlenmemiş öğrenci paydaya girmez
  let yapildi = 0, isaretli = 0, mazeretli = 0
  for (const hw of pastDone) {
    const c = statusMap.get(hw.id)
    if (!c) continue
    yapildi += c.yapildi; mazeretli += c.mazeretli
    isaretli += Object.values(c).reduce((x, y) => x + y, 0)
  }
  const avgPct = oran(yapildi, isaretli, mazeretli)

  // Liste sayfa başına en fazla 50 ödev; altta sayfalama var — ayrıca "+N daha" katlaması yok
  const satir = (hw: HW) => <HomeworkCard key={hw.id} hw={hw} overdue={true} canWrite={canWrite && hw.teacher_id === userId} userId={userId} statusMap={statusMap} classStudentMap={classStudentMap} />

  return (
    <section>
      <SectionHeader label="Kontrol edildi" count={pastDone.length}>
        {avgPct !== null && <span className="text-xs text-gray-500 dark:text-slate-400">ortalama %{avgPct} yapıldı</span>}
      </SectionHeader>
      <div className="bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/60">
        {pastDone.map(satir)}
      </div>
    </section>
  )
}
