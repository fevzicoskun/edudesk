import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SinavOrtalamaChart = dynamic(() => import('./SinavOrtalamaChart'), { ssr: false })

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
            Sınav Ortalamaları
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

  const avgMap = new Map<string, { sum: number; count: number }>()
  for (const e of exams) avgMap.set(e.id, { sum: 0, count: 0 })
  for (const entry of entries ?? []) {
    const m = avgMap.get(entry.exam_id)
    if (m) { m.sum += entry.grade; m.count++ }
  }

  const chartData = [...exams].reverse().map(e => {
    const m = avgMap.get(e.id)!
    const label = e.title.length > 14 ? e.title.slice(0, 13) + '…' : e.title
    return {
      title:     label,
      ortalama:  m.count > 0 ? Math.round(m.sum / m.count) : 0,
      katilimci: m.count,
    }
  })

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Sınav Ortalamaları
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">Son 6 ortak sınav · puan</p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <SinavOrtalamaChart data={chartData} />
      </CardContent>
    </Card>
  )
}
