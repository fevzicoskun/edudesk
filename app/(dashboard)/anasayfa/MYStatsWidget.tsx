import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'

type AlertType = 'red' | 'yellow' | 'green'

const ALERT_RING: Record<AlertType, string> = {
  red:    'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
  yellow: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  green:  'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
}
const ALERT_DOT: Record<AlertType, string> = {
  red:    'bg-red-500',
  yellow: 'bg-amber-400',
  green:  'bg-emerald-500',
}

function statColor(ok: boolean, warn: boolean) {
  if (ok)   return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
  if (warn) return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
}

export default async function MYStatsWidget() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()

  const today        = new Date()
  const todayStr     = today.toISOString().split('T')[0]
  const twoWeeksAgo  = subDays(today, 14).toISOString()
  const thirtyDaysAgo = subDays(today, 30).toISOString().split('T')[0]

  const [profilesRes, classesRes, studentsRes, todayAttRes, absent30Res, sessionsRes] = await Promise.all([
    supabase.from('profiles').select('id').eq('school_id', school_id).in('role', ['ogretmen', 'zumre_baskani']),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', school_id),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school_id).is('deleted_at', null),
    supabase.from('attendance').select('class_id, status').eq('school_id', school_id).eq('date', todayStr),
    supabase.from('attendance').select('student_id').eq('school_id', school_id).eq('status', 'absent').gte('date', thirtyDaysAgo),
    supabase.from('user_sessions').select('user_id, last_seen_at').eq('school_id', school_id),
  ])

  const teachers   = profilesRes.data ?? []
  const classCount = classesRes.count  ?? 0
  const totalStudents = studentsRes.count ?? 0

  const todayAtt       = todayAttRes.data ?? []
  const classesWithAtt = new Set(todayAtt.map(a => a.class_id))
  const todayAbsent    = todayAtt.filter(a => a.status === 'absent').length

  const absenceMap = new Map<string, number>()
  for (const a of absent30Res.data ?? []) {
    absenceMap.set(a.student_id, (absenceMap.get(a.student_id) ?? 0) + 1)
  }
  const riskCount = [...absenceMap.values()].filter(n => n >= 5).length

  const lastSeenMap = new Map<string, string>()
  for (const s of sessionsRes.data ?? []) {
    const prev = lastSeenMap.get(s.user_id)
    if (!prev || s.last_seen_at > prev) lastSeenMap.set(s.user_id, s.last_seen_at)
  }
  const activeCount   = teachers.filter(t => (lastSeenMap.get(t.id) ?? '') >= twoWeeksAgo).length
  const inactiveCount = teachers.length - activeCount

  const alerts: { text: string; type: AlertType }[] = []
  const missingAtt = classCount - classesWithAtt.size
  if (missingAtt > 0 && classCount > 0)
    alerts.push({ text: `${missingAtt} sınıf yoklaması girilmemiş`, type: 'yellow' })
  if (todayAbsent >= 5)
    alerts.push({ text: `Bugün ${todayAbsent} devamsız öğrenci`, type: 'red' })
  else if (todayAbsent > 0)
    alerts.push({ text: `Bugün ${todayAbsent} devamsız öğrenci`, type: 'yellow' })
  if (riskCount > 0)
    alerts.push({ text: `${riskCount} öğrenci devamsızlık sınırına yakın`, type: 'yellow' })
  if (inactiveCount > 0)
    alerts.push({ text: `${inactiveCount} öğretmen 2 haftadır giriş yapmadı`, type: 'yellow' })
  if (alerts.length === 0)
    alerts.push({ text: 'Tüm operasyonel göstergeler normal', type: 'green' })

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {alerts.map((a, i) => (
          <span key={i} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${ALERT_RING[a.type]}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ALERT_DOT[a.type]}`} />{a.text}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 ${statColor(classesWithAtt.size >= classCount && classCount > 0, false)}`}>
          <p className="text-3xl font-bold leading-none">
            {classesWithAtt.size}<span className="text-base font-medium opacity-60">/{classCount}</span>
          </p>
          <p className="text-sm font-medium mt-1.5">Yoklama Alınan Sınıf</p>
          <p className="text-[11px] opacity-70 mt-0.5">bugün</p>
        </div>
        <div className={`rounded-xl border p-4 ${statColor(todayAbsent === 0, todayAbsent >= 5)}`}>
          <p className="text-3xl font-bold leading-none">{todayAbsent}</p>
          <p className="text-sm font-medium mt-1.5">Devamsız Öğrenci</p>
          <p className="text-[11px] opacity-70 mt-0.5">bugün · {totalStudents} toplam</p>
        </div>
        <div className={`rounded-xl border p-4 ${statColor(inactiveCount === 0, false)}`}>
          <p className="text-3xl font-bold leading-none">
            {activeCount}<span className="text-base font-medium opacity-60">/{teachers.length}</span>
          </p>
          <p className="text-sm font-medium mt-1.5">Aktif Öğretmen</p>
          <p className="text-[11px] opacity-70 mt-0.5">son 2 hafta içinde giriş</p>
        </div>
      </div>
    </>
  )
}
