import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'
import { Card, CardContent } from '@/components/ui/card'

export default async function MudurGunlukOzetKartlari() {
  const supabase   = await createClient()
  const school_id  = await requireSchoolId()
  const todayStr   = new Date().toISOString().split('T')[0]
  const twoWeeksAgo = subDays(new Date(), 14).toISOString()

  const [classesRes, attendanceRes, profilesRes, sessionsRes] = await Promise.all([
    supabase.from('classes').select('id', { count: 'exact', head: true })
      .eq('school_id', school_id).is('deleted_at', null),
    supabase.from('attendance').select('class_id, status')
      .eq('school_id', school_id).eq('date', todayStr),
    supabase.from('profiles').select('id, role')
      .eq('school_id', school_id)
      .in('role', ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi']),
    supabase.from('user_sessions').select('user_id, last_seen_at')
      .eq('school_id', school_id),
  ])

  const totalClasses     = classesRes.count ?? 0
  const attendance       = attendanceRes.data ?? []
  const teachers         = profilesRes.data ?? []
  const sessions         = sessionsRes.data ?? []

  const classesWithAttendance = new Set(attendance.map(a => a.class_id))
  const completedCount   = classesWithAttendance.size
  const absentCount      = attendance.filter(a => a.status === 'absent').length

  const lastSeenMap = new Map<string, string>()
  for (const s of sessions) {
    const prev = lastSeenMap.get(s.user_id)
    if (!prev || s.last_seen_at > prev) lastSeenMap.set(s.user_id, s.last_seen_at)
  }
  const inactiveCount = teachers.filter(t => {
    const ls = lastSeenMap.get(t.id)
    return !ls || ls < twoWeeksAgo
  }).length

  const yoklamaRatio = totalClasses > 0 ? completedCount / totalClasses : 1

  const cards = [
    {
      value: absentCount,
      label: 'Bugün Devamsız',
      sub: 'öğrenci',
      color: absentCount === 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : absentCount > 10 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
      dot: absentCount === 0 ? 'bg-emerald-500' : absentCount > 10 ? 'bg-red-500' : 'bg-amber-500',
    },
    {
      value: `${completedCount}/${totalClasses}`,
      label: 'Yoklama Girilen',
      sub: 'sınıf',
      color: yoklamaRatio === 1
        ? 'text-emerald-600 dark:text-emerald-400'
        : yoklamaRatio >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
      dot: yoklamaRatio === 1 ? 'bg-emerald-500' : yoklamaRatio >= 0.5 ? 'bg-amber-500' : 'bg-red-500',
    },
    {
      value: inactiveCount,
      label: 'Pasif Öğretmen',
      sub: '14+ gün giriş yok',
      color: inactiveCount === 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : inactiveCount >= 3 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
      dot: inactiveCount === 0 ? 'bg-emerald-500' : inactiveCount >= 3 ? 'bg-red-500' : 'bg-amber-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="border-gray-200 dark:border-slate-700 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{c.label}</p>
            </div>
            <p className={`text-3xl font-bold tabular-nums leading-none ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
