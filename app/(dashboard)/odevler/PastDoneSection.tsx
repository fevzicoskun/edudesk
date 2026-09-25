import HomeworkCard from './HomeworkCard'
import SectionHeader from './SectionHeader'
import type { HW, StatusCounts } from './types'

const ILK_GORUNEN = 8

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

  // Kontrol edilmiş (son tarihi geçmiş + işaretlenmiş) ödevler — diğer iki bölümle aynı görünür.
  // En yeni ILK_GORUNEN tanesi açık, kalanı "+N daha" altında (liste 50'ye kadar uzayabiliyor)
  const ilk = pastDone.slice(0, ILK_GORUNEN)
  const kalan = pastDone.slice(ILK_GORUNEN)
  const satir = (hw: HW) => <HomeworkCard key={hw.id} hw={hw} overdue={true} canWrite={canWrite && hw.teacher_id === userId} userId={userId} statusMap={statusMap} classStudentMap={classStudentMap} />

  return (
    <section>
      <SectionHeader label="Kontrol edildi" count={pastDone.length}>
        {avgPct !== null && <span className="text-xs text-gray-500 dark:text-slate-400">ortalama %{avgPct} yapıldı</span>}
      </SectionHeader>
      <div className="bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/60">
        {ilk.map(satir)}
        {kalan.length > 0 && (
          <details className="group">
            <summary className="px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer list-none select-none hover:bg-gray-50 dark:hover:bg-slate-700/50 group-open:border-b group-open:border-gray-100 dark:group-open:border-slate-700/60">
              <span className="group-open:hidden">+{kalan.length} ödev daha</span>
              <span className="hidden group-open:inline">Daha az göster</span>
            </summary>
            <div className="divide-y divide-gray-100 dark:divide-slate-700/60">{kalan.map(satir)}</div>
          </details>
        )}
      </div>
    </section>
  )
}
