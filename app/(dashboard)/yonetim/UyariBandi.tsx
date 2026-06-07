import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'

type AlertLevel = 'yellow'

interface Alert {
  text: string
  level: AlertLevel
}

const STYLES: Record<AlertLevel, { pill: string; dot: string }> = {
  yellow: { pill: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
}

export default async function UyariBandi() {
  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const today     = new Date()
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

  const { data: meetings } = await supabase
    .from('school_meetings')
    .select('id')
    .eq('school_id', school_id)
    .gte('meeting_date', thisMonthStart)
    .neq('meeting_type', 'not')

  const alerts: Alert[] = []

  if ((meetings ?? []).length === 0) {
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
            <span>{a.text}</span>
          </div>
        )
      })}
    </div>
  )
}
