import { todayLocalISO } from '@/src/shared/date'
import { weekStartOf, formatWeekLabel } from '@/src/domains/studyPlan/planMath'
import { StudyPlanService } from '@/src/domains/studyPlan/services/StudyPlanService'
import HaftaEditoru from '../../plan/HaftaEditoru'

// Öğrenci 360: bu haftanın çalışma planı (tüm öğretmenler; yalnız kendi maddeleri düzenlenir).
export default async function HaftalikPlanSection({ studentId, currentUserId }: { studentId: string; currentUserId: string }) {
  const weekStart = weekStartOf(todayLocalISO())
  const [{ items, error }, sources, canWrite] = await Promise.all([
    StudyPlanService.getStudentWeek(studentId, weekStart),
    StudyPlanService.getSources(studentId),
    StudyPlanService.canWriteFor(studentId),
  ])
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Haftalık Çalışma Planı</h2>
        <span className="text-xs text-gray-500 dark:text-slate-400">{formatWeekLabel(weekStart)}</span>
      </div>
      {error ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{error}</p>
      ) : (
        <HaftaEditoru studentId={studentId} weekStart={weekStart} items={items} sources={sources} currentUserId={currentUserId} canWrite={canWrite} showTeacher />
      )}
    </section>
  )
}
