import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'
import { Card, CardContent } from '@/components/ui/card'

export default async function MudurGunlukOzetKartlari() {
  const supabase     = await createClient()
  const school_id    = await requireSchoolId()
  const todayStr     = new Date().toISOString().split('T')[0]
  const yesterdayStr = subDays(new Date(), 1).toISOString().split('T')[0]
  const weekAgoStr   = subDays(new Date(), 7).toISOString().split('T')[0]

  const [classesRes, attendanceRes, weekAbsenceRes] = await Promise.all([
    supabase.from('classes').select('id', { count: 'exact', head: true })
      .eq('school_id', school_id).is('deleted_at', null),
    supabase.from('attendance').select('class_id, status')
      .eq('school_id', school_id).eq('date', todayStr),
    supabase.from('attendance').select('date')
      .eq('school_id', school_id).eq('status', 'absent')
      .gte('date', weekAgoStr).lt('date', todayStr),
  ])

  const totalClasses = classesRes.count ?? 0
  const attendance   = attendanceRes.data ?? []
  const weekAbsences = weekAbsenceRes.data ?? []

  const classesWithAttendance = new Set(attendance.map(a => a.class_id))
  const completedCount = classesWithAttendance.size
  const absentCount    = attendance.filter(a => a.status === 'absent').length

  const absenceByDay = new Map<string, number>()
  for (const a of weekAbsences) {
    absenceByDay.set(a.date, (absenceByDay.get(a.date) ?? 0) + 1)
  }
  const yesterdayAbsent = absenceByDay.get(yesterdayStr) ?? null
  const weekDays = [...absenceByDay.values()]
  const weekAvg  = weekDays.length > 0
    ? Math.round(weekDays.reduce((s, n) => s + n, 0) / weekDays.length)
    : null

  const yoklamaRatio = totalClasses > 0 ? completedCount / totalClasses : 1

  const absentSub = [
    yesterdayAbsent !== null ? `dün: ${yesterdayAbsent}` : null,
    weekAvg !== null ? `haftalık ort: ${weekAvg}` : null,
  ].filter(Boolean).join(' · ') || 'öğrenci'

  const cards = [
    {
      value: absentCount,
      label: 'Bugün Devamsız',
      sub: absentSub,
      href: '/yonetim/devamsizlar' as string | null,
      color: absentCount === 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : absentCount > 10 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
      dot: absentCount === 0 ? 'bg-emerald-500' : absentCount > 10 ? 'bg-red-500' : 'bg-amber-500',
    },
    {
      value: `${completedCount}/${totalClasses}`,
      label: 'Yoklama Girilen',
      sub: 'sınıf',
      href: '/yonetim#bugun-yoklama' as string | null,
      color: yoklamaRatio === 1
        ? 'text-emerald-600 dark:text-emerald-400'
        : yoklamaRatio >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
      dot: yoklamaRatio === 1 ? 'bg-emerald-500' : yoklamaRatio >= 0.5 ? 'bg-amber-500' : 'bg-red-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cards.map(c => {
        const inner = (
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{c.label}</p>
            </div>
            <p className={`text-3xl font-bold tabular-nums leading-none ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{c.sub}</p>
          </CardContent>
        )
        return c.href ? (
          <Link key={c.label} href={c.href}>
            <Card className="border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all cursor-pointer">
              {inner}
            </Card>
          </Link>
        ) : (
          <Card key={c.label} className="border-gray-200 dark:border-slate-700 shadow-sm">
            {inner}
          </Card>
        )
      })}
    </div>
  )
}
