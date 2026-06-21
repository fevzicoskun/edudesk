import Link from 'next/link'
import { requireSchoolId } from '@/src/shared/auth'
import { donemBasi } from '@/src/shared/utils'
import { getSchoolTeachers } from '@/src/domains/dashboard/queries/schoolStats'
import { getAttendanceTrendRows, getHomeworkTrendRows, getTrendClasses } from '@/src/domains/dashboard/queries/schoolTrends'
import {
  computeAbsenceTrend, computeActivityTrend, computeCoverageTrend, computeClassAbsence,
} from '@/src/domains/dashboard/lib/trendMath'
import { computeEarlyWarnings, hasEnoughBaseline } from '@/src/domains/dashboard/lib/earlyWarning'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ErkenUyarilarWidget() {
  const school_id = await requireSchoolId()
  const donemStart = donemBasi()
  const now = new Date()

  const [attRows, hwRows, classes, teachers] = await Promise.all([
    getAttendanceTrendRows(school_id, donemStart),
    getHomeworkTrendRows(school_id, donemStart),
    getTrendClasses(school_id),
    getSchoolTeachers(school_id),
  ])

  const absence  = computeAbsenceTrend(attRows, donemStart, now)
  const activity = computeActivityTrend(attRows, hwRows, teachers.length, donemStart, now)
  const coverage = computeCoverageTrend(attRows, classes.length, donemStart, now)
  const classAbs = computeClassAbsence(attRows, classes)

  const warnings = computeEarlyWarnings(absence, activity, coverage, classAbs, now)

  // "veri birikiyor" kararı pencere mantığıyla aynı kaynaktan (yarım hafta dışlaması tutarlı)
  const yetersiz = !hasEnoughBaseline(absence, now)

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Erken Uyarılar
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Son tamamlanan hafta · dönem ortalamasına göre
        </p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {warnings.length === 0 ? (
          yetersiz ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 py-2">
              Trend uyarıları için veri birikiyor.
            </p>
          ) : (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
              Tüm trendler stabil ✓
            </p>
          )
        ) : (
          <ul className="space-y-2.5">
            {warnings.map(w => {
              const dot = w.severity === 'yuksek' ? 'bg-red-500' : 'bg-amber-400'
              const row = (
                <div className="flex items-start gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{w.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{w.detail}</p>
                  </div>
                </div>
              )
              return (
                <li key={w.id}>
                  {w.classId
                    ? <Link href={`/siniflar/${w.classId}`} className="block hover:opacity-80">{row}</Link>
                    : row}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
