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
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', school_id).is('deleted_at', null),
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

  const activeCount = teacherProfiles.length - inactiveTeachers.length
  const activeGradient = inactiveTeachers.length > 0
    ? 'from-amber-500 to-amber-600'
    : 'from-emerald-500 to-emerald-600'

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          value={studentCount} label="Öğrenci" sub={`${classCount} sınıf`} href="/yonetim/ogrenciler"
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

    </>
  )
}
