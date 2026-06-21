// app/(dashboard)/anasayfa/MudurTrendWidget.tsx
import Link from 'next/link'
import { requireSchoolId } from '@/src/shared/auth'
import { schoolYearStart } from '@/src/shared/utils'
import { getSchoolTeachers } from '@/src/domains/dashboard/queries/schoolStats'
import { getAttendanceTrendRows, getHomeworkTrendRows, getTrendClasses } from '@/src/domains/dashboard/queries/schoolTrends'
import { computeAbsenceTrend, computeActivityTrend, computeClassAbsence, filledWeekCount } from '@/src/domains/dashboard/lib/trendMath'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TrendChart from './charts/TrendChart'

const MIN_WEEKS = 2

function BirikiyorCard({ title, weeks }: { title: string; weeks: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Trend için veri birikiyor — şu ana kadar {weeks} hafta. En az {MIN_WEEKS} hafta gerekiyor.
        </p>
      </CardContent>
    </Card>
  )
}

export default async function MudurTrendWidget() {
  const school_id = await requireSchoolId()
  const yearStart = schoolYearStart()
  const now = new Date()

  const [attRows, hwRows, classes, teachers] = await Promise.all([
    getAttendanceTrendRows(school_id, yearStart),
    getHomeworkTrendRows(school_id, yearStart),
    getTrendClasses(school_id),
    getSchoolTeachers(school_id),
  ])

  const absenceTrend = computeAbsenceTrend(attRows, yearStart, now)
  const activityTrend = computeActivityTrend(attRows, hwRows, teachers.length, yearStart, now)
  const classAbsence = computeClassAbsence(attRows, classes)
  const enoughAbsence = filledWeekCount(absenceTrend) >= MIN_WEEKS
  const enoughActivity = filledWeekCount(activityTrend) >= MIN_WEEKS

  const maxClassRate = classAbsence[0]?.rate ?? 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Devamsızlık trendi */}
      {enoughAbsence ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Devamsızlık oranı (haftalık)</CardTitle></CardHeader>
          <CardContent>
            <TrendChart data={absenceTrend} color="#ef4444" format="percent" />
          </CardContent>
        </Card>
      ) : (
        <BirikiyorCard title="Devamsızlık oranı (haftalık)" weeks={filledWeekCount(absenceTrend)} />
      )}

      {/* Öğretmen aktivite trendi */}
      {enoughActivity ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Öğretmen aktivite oranı (haftalık)</CardTitle></CardHeader>
          <CardContent>
            <TrendChart data={activityTrend} color="#10b981" format="percent" />
          </CardContent>
        </Card>
      ) : (
        <BirikiyorCard title="Öğretmen aktivite oranı (haftalık)" weeks={filledWeekCount(activityTrend)} />
      )}

      {/* Sınıf karşılaştırması */}
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-sm">Sınıf karşılaştırması — devamsızlık</CardTitle></CardHeader>
        <CardContent>
          {classAbsence.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">Henüz yoklama girilmemiş.</p>
          ) : (
            <ul className="space-y-2">
              {classAbsence.map(c => (
                <li key={c.classId}>
                  <Link href={`/siniflar/${c.classId}`} className="flex items-center gap-3 group">
                    <span className="w-16 shrink-0 text-sm text-gray-700 dark:text-slate-300 group-hover:underline">{c.name}</span>
                    <span className="flex-1 h-3 rounded bg-gray-100 dark:bg-slate-800 overflow-hidden">
                      <span
                        className="block h-full bg-red-400"
                        style={{ width: `${maxClassRate === 0 ? 0 : Math.round((c.rate / maxClassRate) * 100)}%` }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-sm tabular-nums text-gray-600 dark:text-slate-400">%{Math.round(c.rate * 100)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
