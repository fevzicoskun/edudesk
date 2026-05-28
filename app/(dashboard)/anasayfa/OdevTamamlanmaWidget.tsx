import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const OdevTamamlanmaChart = dynamic(() => import('./OdevTamamlanmaChart'), { ssr: false })

export default async function OdevTamamlanmaWidget() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: homeworks } = await supabase
    .from('homeworks')
    .select('id, title')
    .eq('teacher_id', user.id)
    .is('deleted_at', null)
    .lte('due_date', today)
    .order('due_date', { ascending: false })
    .limit(6)

  if (!homeworks || homeworks.length === 0) {
    return (
      <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Ödev Tamamlanma Oranları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            Geçmiş ödev bulunamadı.
          </div>
        </CardContent>
      </Card>
    )
  }

  const hwIds = homeworks.map(h => h.id)
  const { data: submissions } = await supabase
    .from('homework_submissions')
    .select('homework_id, status')
    .in('homework_id', hwIds)

  const subMap = new Map<string, { yapildi: number; eksik: number; diger: number; toplam: number }>()
  for (const hw of homeworks) subMap.set(hw.id, { yapildi: 0, eksik: 0, diger: 0, toplam: 0 })
  for (const s of submissions ?? []) {
    const e = subMap.get(s.homework_id)
    if (!e) continue
    e.toplam++
    if      (s.status === 'yapildi') e.yapildi++
    else if (s.status === 'eksik')   e.eksik++
    else                              e.diger++
  }

  const chartData = [...homeworks].reverse().map(hw => {
    const s = subMap.get(hw.id)!
    const t = s.toplam
    const label = hw.title.length > 14 ? hw.title.slice(0, 13) + '…' : hw.title
    return {
      title:   label,
      yapildi: t > 0 ? Math.round((s.yapildi / t) * 100) : 0,
      eksik:   t > 0 ? Math.round((s.eksik   / t) * 100) : 0,
      diger:   t > 0 ? Math.round((s.diger   / t) * 100) : 0,
    }
  })

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Ödev Tamamlanma Oranları
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">Son 6 ödev · %</p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <OdevTamamlanmaChart data={chartData} />
      </CardContent>
    </Card>
  )
}
