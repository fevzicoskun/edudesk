import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import Link from 'next/link'
import { subDays } from '@/src/shared/date'

function StatCard({ value, label, sub, href, color }: {
  value: number | string; label: string; sub?: string; href?: string; color: string
}) {
  const inner = (
    <div className={`rounded-xl border p-3 sm:p-4 h-full transition-opacity ${href ? 'hover:opacity-80' : ''} ${color}`}>
      <p className="text-2xl sm:text-3xl font-bold leading-none">{value}</p>
      <p className="text-xs sm:text-sm font-medium mt-1">{label}</p>
      {sub && <p className="text-[11px] opacity-70 mt-0.5">{sub}</p>}
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
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school_id),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', school_id),
    supabase.from('school_meetings').select('id, meeting_date, meeting_type').eq('school_id', school_id),
    supabase.from('user_sessions').select('user_id, last_seen_at').eq('school_id', school_id),
  ])

  const profiles      = profilesRes.data ?? []
  const studentCount  = studentsRes.count ?? 0
  const classCount    = classesRes.count  ?? 0
  const allMeetings   = meetingsRes.data  ?? []

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

  const redAlerts: string[]    = []
  const yellowAlerts: string[] = []
  const greenAlerts: string[]  = []

  if (inactiveTeachers.length >= 3)      redAlerts.push(`${inactiveTeachers.length} öğretmen 14+ gün pasif`)
  else if (inactiveTeachers.length > 0)  yellowAlerts.push(`${inactiveTeachers.length} öğretmen 14+ gün pasif`)
  else                                   greenAlerts.push('Tüm öğretmenler aktif')

  if (thisMonthMeetings.length === 0) yellowAlerts.push('Bu ay toplantı kaydı yok')

  return (
    <>
      {(redAlerts.length > 0 || yellowAlerts.length > 0 || greenAlerts.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {redAlerts.map(a => (
            <span key={a} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{a}
            </span>
          ))}
          {yellowAlerts.map(a => (
            <span key={a} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />{a}
            </span>
          ))}
          {greenAlerts.map(a => (
            <span key={a} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{a}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard value={studentCount} label="Öğrenci" sub={`${classCount} sınıf`} href="/siniflar"
          color="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200" />
        <StatCard value={teacherProfiles.length} label="Öğretmen"
          sub={`${profiles.filter(p => p.role === 'zumre_baskani').length} başkan`} href="/kullanicilar"
          color="border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200" />
        <StatCard value={classCount} label="Sınıf" href="/siniflar"
          color="border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200" />
        <StatCard value={thisMonthMeetings.length} label="Bu Ay Toplantı" sub="okul geneli"
          color="border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200" />
        <StatCard
          value={teacherProfiles.length - inactiveTeachers.length}
          label="Aktif Öğretmen"
          sub={inactiveTeachers.length > 0 ? `${inactiveTeachers.length} pasif` : 'hepsi aktif'}
          color={inactiveTeachers.length > 0
            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'}
        />
      </div>

      {inactiveTeachers.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{inactiveTeachers.length} öğretmen 14 gündür sisteme giriş yapmadı</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              {inactiveTeachers.slice(0, 4).map(t => t.full_name).join(', ')}
              {inactiveTeachers.length > 4 && ` ve ${inactiveTeachers.length - 4} kişi daha`}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
