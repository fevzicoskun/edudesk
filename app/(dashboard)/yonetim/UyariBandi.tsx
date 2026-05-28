import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'

type AlertLevel = 'red' | 'yellow'

interface Alert {
  text: string
  detail?: string
  level: AlertLevel
}

const STYLES: Record<AlertLevel, { pill: string; dot: string; icon: string }> = {
  red:    { pill: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',       dot: 'bg-red-500',    icon: '🔴' },
  yellow: { pill: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', icon: '🟡' },
}

export default async function UyariBandi() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()
  const today     = new Date()
  const twoWeeksAgo    = subDays(today, 14).toISOString()
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

  const [profilesRes, sessionsRes, meetingsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role')
      .eq('school_id', school_id)
      .in('role', ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi']),
    supabase.from('user_sessions').select('user_id, last_seen_at')
      .eq('school_id', school_id),
    supabase.from('school_meetings').select('id')
      .eq('school_id', school_id)
      .gte('meeting_date', thisMonthStart)
      .neq('meeting_type', 'not'),
  ])

  const teachers = profilesRes.data ?? []
  const sessions = sessionsRes.data ?? []
  const meetingCount = (meetingsRes.data ?? []).length

  const lastSeenMap = new Map<string, string>()
  for (const s of sessions) {
    const prev = lastSeenMap.get(s.user_id)
    if (!prev || s.last_seen_at > prev) lastSeenMap.set(s.user_id, s.last_seen_at)
  }

  const inactive = teachers.filter(t => {
    const ls = lastSeenMap.get(t.id)
    return !ls || ls < twoWeeksAgo
  })

  const alerts: Alert[] = []

  if (inactive.length >= 3) {
    alerts.push({
      level: 'red',
      text: `${inactive.length} öğretmen 14+ gün pasif`,
      detail: inactive.slice(0, 3).map(t => t.full_name).join(', ') + (inactive.length > 3 ? ` +${inactive.length - 3}` : ''),
    })
  } else if (inactive.length > 0) {
    alerts.push({
      level: 'yellow',
      text: `${inactive.length} öğretmen 14+ gün pasif`,
      detail: inactive.map(t => t.full_name).join(', '),
    })
  }

  if (meetingCount === 0) {
    alerts.push({ level: 'yellow', text: 'Bu ay toplantı kaydı yok' })
  }

  if (alerts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2" role="alert" aria-label="Yönetim uyarıları">
      {alerts.map((a, i) => {
        const s = STYLES[a.level]
        return (
          <div key={i} className={`inline-flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-medium ${s.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${s.dot}`} />
            <span>
              {a.text}
              {a.detail && (
                <span className="block text-[11px] opacity-70 mt-0.5">{a.detail}</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
