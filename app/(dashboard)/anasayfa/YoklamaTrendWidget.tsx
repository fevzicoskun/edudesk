import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { subDays } from '@/src/shared/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import YoklamaTrendChart from './YoklamaTrendChart'

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function shortLabel(isoDate: string): string {
  const d = new Date(isoDate)
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export default async function YoklamaTrendWidget() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const since = subDays(new Date(), 56).toISOString().split('T')[0]

  const { data } = await supabase
    .from('attendance')
    .select('date, status')
    .eq('teacher_id', user.id)
    .gte('date', since)
    .order('date')

  const weekMap = new Map<string, { devamsiz: number; toplam: number }>()
  for (const r of data ?? []) {
    const key = mondayOf(r.date)
    if (!weekMap.has(key)) weekMap.set(key, { devamsiz: 0, toplam: 0 })
    const e = weekMap.get(key)!
    e.toplam++
    if (r.status === 'absent') e.devamsiz++
  }

  const chartData = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { devamsiz, toplam }]) => ({
      hafta: shortLabel(week),
      oran: toplam > 0 ? Math.round((devamsiz / toplam) * 100) : 0,
      devamsiz,
      toplam,
    }))

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Devamsızlık Trendi
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">Son 8 hafta · %</p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {chartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            Henüz yoklama kaydı yok.
          </div>
        ) : (
          <YoklamaTrendChart data={chartData} />
        )}
      </CardContent>
    </Card>
  )
}
