import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import Link from 'next/link'
import { subDays } from '@/src/shared/date'

function StatCard({ value, label, sub, href, gradient }: {
  value: number | string
  label: string
  sub?: string
  href?: string
  gradient: string
}) {
  const inner = (
    <div className={`rounded-xl p-3 sm:p-4 h-full bg-gradient-to-br shadow-md transition-all ${href ? 'hover:scale-[1.02] hover:shadow-lg' : ''} ${gradient}`}>
      <p className="text-2xl sm:text-3xl font-bold leading-none text-white tabular-nums truncate">{value}</p>
      <p className="text-xs sm:text-sm font-medium mt-1 text-white/90">{label}</p>
      {sub && <p className="text-[11px] text-white/65 mt-0.5">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default async function MudurStatsWidget() {
  const supabase   = await createClient()
  const school_id  = await requireSchoolId()

  const today          = new Date()
  const twoWeeksAgo    = subDays(today, 14).toISOString()
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

  const [profilesRes, studentsRes, classesRes, meetingsRes, sessionsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, subject').eq('school_id', school_id),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school_id).is('deleted_at', null),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', school_id),
    supabase.from('school_meetings').select('id, meeting_date, meeting_type').eq('school_id', school_id),
    supabase.from('user_sessions').select('user_id, last_seen_at').eq('school_id', school_id),
  ])

  const profiles     = profilesRes.data ?? []
  const studentCount = studentsRes.count ?? 0
  const classCount   = classesRes.count  ?? 0
  const allMeetings  = meetingsRes.data  ?? []

  const teacherProfiles = profiles.filter(p =>
    p.role === 'ogretmen' || p.role === 'zumre_baskani' || p.role === 'mudur_yardimcisi'
  )
  const thisMonthMeetings = allMeetings.filter(m => m.meeting_date >= thisMonthStart && m.meeting_type !== 'not')

  const lastSeenMap = new Map<string, string>()
  for (const s of sessionsRes.data ?? []) {
    const prev = lastSeenMap.get(s.user_id)
    if (!prev || s.last_seen_at > prev) lastSeenMap.set(s.user_id, s.last_seen_at)
  }

  const inactiveTeachers = teacherProfiles.filter(t => {
    const ls = lastSeenMap.get(t.id)
    return !ls || ls < twoWeeksAgo
  })

  const alerts: { text: string; level: 'red' | 'yellow' | 'green' }[] = []
  if (inactiveTeachers.length >= 3)      alerts.push({ text: `${inactiveTeachers.length} öğretmen 14+ gün pasif`, level: 'red' })
  else if (inactiveTeachers.length > 0)  alerts.push({ text: `${inactiveTeachers.length} öğretmen 14+ gün pasif`, level: 'yellow' })
  else                                   alerts.push({ text: 'Tüm öğretmenler aktif', level: 'green' })
  if (thisMonthMeetings.length === 0)    alerts.push({ text: 'Bu ay toplantı kaydı yok', level: 'yellow' })

  const ALERT_STYLE = {
    red:    'bg-red-500/20 text-red-300 border border-red-500/30',
    yellow: 'bg-amber-500/20 text-amber-200 border border-amber-500/30',
    green:  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  }
  const ALERT_DOT = {
    red: 'bg-red-400', yellow: 'bg-amber-400', green: 'bg-emerald-400',
  }

  const activeCount = teacherProfiles.length - inactiveTeachers.length
  const activeGradient = inactiveTeachers.length > 0
    ? 'from-amber-500 to-amber-600'
    : 'from-emerald-500 to-emerald-600'

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {alerts.map((a, i) => (
          <span key={i} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${ALERT_STYLE[a.level]}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ALERT_DOT[a.level]}`} />
            {a.text}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          value={studentCount} label="Öğrenci" sub={`${classCount} sınıf`} href="/siniflar"
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          value={teacherProfiles.length} label="Öğretmen"
          sub={`${profiles.filter(p => p.role === 'zumre_baskani').length} başkan`} href="/kullanicilar"
          gradient="from-violet-500 to-violet-600"
        />
        <StatCard
          value={classCount} label="Sınıf" href="/siniflar"
          gradient="from-indigo-500 to-indigo-600"
        />
        <StatCard
          value={thisMonthMeetings.length} label="Bu Ay Toplantı" sub="okul geneli"
          gradient="from-teal-500 to-teal-600"
        />
        <StatCard
          value={activeCount} label="Aktif Öğretmen"
          sub={inactiveTeachers.length > 0 ? `${inactiveTeachers.length} pasif` : 'hepsi aktif'}
          gradient={activeGradient}
        />
      </div>

      {inactiveTeachers.length > 0 && (
        <div className="flex items-start gap-3 p-4 mt-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-200">{inactiveTeachers.length} öğretmen 14 gündür sisteme giriş yapmadı</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              {inactiveTeachers.slice(0, 4).map(t => t.full_name).join(', ')}
              {inactiveTeachers.length > 4 && ` ve ${inactiveTeachers.length - 4} kişi daha`}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
