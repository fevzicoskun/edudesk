import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { format, parseISO } from '@/src/shared/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SinavOrtalamaChart from './SinavOrtalamaChart'

function TrendBadge({ delta, inverse = false }: { delta: number; inverse?: boolean }) {
  if (delta === 0) return <span className="text-[10px] text-gray-400 ml-1">—</span>
  const isBad = inverse ? delta > 0 : delta < 0
  return (
    <span className={`text-[10px] font-semibold ml-1 ${isBad ? 'text-red-500' : 'text-emerald-500'}`}>
      {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
    </span>
  )
}

export default async function SinavOrtalamaWidget() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()

  const { data: exams } = await supabase
    .from('common_exams')
    .select('id, title, exam_date')
    .eq('school_id', school_id)
    .is('deleted_at', null)
    .order('exam_date', { ascending: false })
    .limit(6)

  if (!exams || exams.length === 0) {
    return (
      <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Sınav Sonuçları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            Henüz ortak sınav kaydı yok.
          </div>
        </CardContent>
      </Card>
    )
  }

  const examIds = exams.map(e => e.id)
  const { data: entries } = await supabase
    .from('exam_entries')
    .select('exam_id, grade')
    .in('exam_id', examIds)

  const allEntries = entries ?? []

  const avgMap = new Map<string, { sum: number; count: number }>()
  for (const e of exams) avgMap.set(e.id, { sum: 0, count: 0 })
  for (const entry of allEntries) {
    const m = avgMap.get(entry.exam_id)
    if (m) { m.sum += entry.grade; m.count++ }
  }

  const chartData = [...exams].reverse().map(e => {
    const m = avgMap.get(e.id)!
    const label = e.title.length > 14 ? e.title.slice(0, 13) + '…' : e.title
    return { title: label, ortalama: m.count > 0 ? Math.round(m.sum / m.count) : 0, katilimci: m.count }
  })

  // Son sınav
  const latestExam    = exams[0]
  const latestEntries = allEntries.filter(e => e.exam_id === latestExam.id)
  const total   = latestEntries.length
  const below50 = latestEntries.filter(e => e.grade < 50).length
  const above85 = latestEntries.filter(e => e.grade >= 85).length
  const latestAvg = total > 0 ? Math.round(latestEntries.reduce((s, e) => s + e.grade, 0) / total) : null

  // Önceki sınavla trend karşılaştırması
  const prevExam    = exams.length > 1 ? exams[1] : null
  const prevEntries = prevExam ? allEntries.filter(e => e.exam_id === prevExam.id) : []
  const prevBelow50 = prevEntries.filter(e => e.grade < 50).length
  const prevAvg     = prevEntries.length > 0
    ? Math.round(prevEntries.reduce((s, e) => s + e.grade, 0) / prevEntries.length)
    : null

  const riskDelta = prevExam && prevEntries.length > 0 ? below50 - prevBelow50 : null
  const avgDelta  = prevAvg !== null && latestAvg !== null ? latestAvg - prevAvg : null

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Sınav Sonuçları
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">Son 6 ortak sınav · puan</p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <SinavOrtalamaChart data={chartData} />

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-gray-400 dark:text-slate-500">
              Son sınav:{' '}
              <span className="font-semibold text-gray-600 dark:text-slate-300">{latestExam.title}</span>
              {' · '}{format(parseISO(latestExam.exam_date), 'd MMM')}
              {total > 0 && ` · ${total} öğrenci`}
            </p>
            {prevExam && (
              <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
                vs. {prevExam.title}
              </span>
            )}
          </div>

          {total === 0 ? (
            <p className="text-xs text-gray-400 dark:text-slate-500">Henüz sonuç girilmemiş.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-center">
                <p className={`text-lg font-bold tabular-nums ${below50 > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {below50}
                  {riskDelta !== null && <TrendBadge delta={riskDelta} inverse />}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">Risk &lt;50</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-slate-700/40 px-3 py-2 text-center">
                <p className={`text-lg font-bold tabular-nums ${latestAvg !== null && latestAvg >= 70 ? 'text-indigo-600 dark:text-indigo-400' : latestAvg !== null && latestAvg >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                  {latestAvg ?? '—'}
                  {avgDelta !== null && <TrendBadge delta={avgDelta} />}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">Ort. puan</p>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-center">
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {above85}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">Başarılı ≥85</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
