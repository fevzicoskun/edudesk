import { createClient } from '@/lib/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import Link from 'next/link'
import { subDays, addDays, format, parseISO } from '@/src/shared/date'
import OkulAyarlari from './OkulAyarlari'
import AjandaWidget from './AjandaWidget'
import RaporButton from '@/components/RaporButton'
import MentorOzetiWidget from './MentorOzetiWidget'
import ZumreOgretmenWidget from './ZumreOgretmenWidget'

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

export default async function MudurDashboard({ fullName }: { fullName: string }) {
  const supabase = await createClient()
  const school_id = await requireSchoolId()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const twoWeeksAgo = subDays(today, 14).toISOString()
  const thirtyDaysAgo = subDays(today, 30).toISOString().split('T')[0]
  const next7Str = addDays(today, 7).toISOString().split('T')[0]

  const [
    schoolRes, profilesRes, studentsRes, classesRes,
    meetingsRes, zumreRes, mentorReportsRes, sessionsRes,
  ] = await Promise.all([
    supabase.from('schools').select('name, slug').eq('id', school_id).single(),
    supabase.from('profiles').select('id, full_name, role, subject').eq('school_id', school_id),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school_id),
    supabase.from('classes').select('id, name, grade').eq('school_id', school_id).order('grade').order('name'),
    supabase.from('school_meetings')
      .select('id, title, meeting_date, meeting_type, attendees, notes')
      .eq('school_id', school_id)
      .order('meeting_date', { ascending: false }),
    supabase.from('zumre_meetings')
      .select('id, title, meeting_date, branch')
      .eq('school_id', school_id)
      .order('meeting_date', { ascending: false })
      .limit(50),
    supabase.from('mentor_reports')
      .select('mentor_id')
      .eq('school_id', school_id)
      .gte('report_date', thirtyDaysAgo),
    supabase.from('user_sessions')
      .select('user_id, login_at, last_seen_at, duration_minutes')
      .eq('school_id', school_id),
  ])

  const schoolName = schoolRes.data?.name ?? ''
  const schoolCode = schoolRes.data?.slug ?? ''
  const profiles = profilesRes.data ?? []
  const studentCount = studentsRes.count ?? 0
  const classes = classesRes.data ?? []
  const allMeetings = meetingsRes.data ?? []
  const zumreMeetings = zumreRes.data ?? []

  // Mentör rapor özeti (son 30 gün)
  const mentorReportCounts = new Map<string, number>()
  for (const r of mentorReportsRes.data ?? []) {
    mentorReportCounts.set(r.mentor_id, (mentorReportCounts.get(r.mentor_id) ?? 0) + 1)
  }
  const mentorSummary = [...mentorReportCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const meetings = allMeetings.filter(m => m.meeting_type !== 'not')

  const teacherProfiles = profiles.filter(p =>
    p.role === 'ogretmen' || p.role === 'zumre_baskani' || p.role === 'mudur_yardimcisi'
  )

  const teacherIds = teacherProfiles.map(t => t.id)
  const sessions = sessionsRes.data ?? []

  type SessionSummary = { count: number; totalMinutes: number; lastSeen: string | null }
  const sessionMap = new Map<string, SessionSummary>()
  for (const s of sessions) {
    const prev = sessionMap.get(s.user_id) ?? { count: 0, totalMinutes: 0, lastSeen: null }
    prev.count += 1
    const mins = s.duration_minutes ?? Math.max(
      Math.round((new Date(s.last_seen_at).getTime() - new Date(s.login_at).getTime()) / 60000), 1
    )
    prev.totalMinutes += mins
    if (!prev.lastSeen || s.last_seen_at > prev.lastSeen) prev.lastSeen = s.last_seen_at
    sessionMap.set(s.user_id, prev)
  }

  const inactiveTeachers = teacherProfiles.filter(t => {
    const ls = sessionMap.get(t.id)?.lastSeen
    return !ls || ls < twoWeeksAgo
  })

  const sortedTeachers = [...teacherProfiles].sort((a, b) => {
    const aL = sessionMap.get(a.id)?.lastSeen ?? ''
    const bL = sessionMap.get(b.id)?.lastSeen ?? ''
    return bL.localeCompare(aL)
  })

  // Bu hafta school meetings
  const weekMeetings = meetings.filter(m =>
    m.meeting_date >= todayStr && m.meeting_date <= next7Str
  )

  // Bu hafta zümre toplantıları
  const weekZumre = zumreMeetings.filter(m =>
    m.meeting_date >= todayStr && m.meeting_date <= next7Str
  )

  // Zümre dalları son 30 günde toplantı yaptı mı?
  const recentBranches = new Set(
    zumreMeetings
      .filter(m => m.meeting_date >= thirtyDaysAgo)
      .map(m => m.branch)
      .filter(Boolean)
  )
  const allBranches = new Set(
    [...teacherProfiles.map(t => t.subject), ...zumreMeetings.map(m => m.branch)]
      .filter(Boolean) as string[]
  )
  const inactiveBranches = [...allBranches].filter(b => !recentBranches.has(b))

  // Bu ayın toplantıları
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const thisMonthMeetings = meetings.filter(m => m.meeting_date >= thisMonthStart)

  // Alert seviyeleri
  const redAlerts: string[] = []
  const yellowAlerts: string[] = []
  const greenAlerts: string[] = []

  if (inactiveTeachers.length >= 3) redAlerts.push(`${inactiveTeachers.length} öğretmen 14+ gün pasif`)
  else if (inactiveTeachers.length > 0) yellowAlerts.push(`${inactiveTeachers.length} öğretmen 14+ gün pasif`)
  else greenAlerts.push('Tüm öğretmenler aktif')

  if (weekMeetings.length > 0) yellowAlerts.push(`Bu hafta ${weekMeetings.length} toplantı`)

  if (inactiveBranches.length > 0) yellowAlerts.push(`${inactiveBranches.length} zümre 30+ gün toplantısız`)
  else if (allBranches.size > 0) greenAlerts.push('Zümreler aktif')

  if (meetings.length === 0) yellowAlerts.push('Henüz toplantı kaydı yok')

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Başlık */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Okul Yönetim Paneli</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {fullName} · {format(today, 'd MMMM yyyy, EEEE')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/yonetim" className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Yeni Toplantı
          </Link>
          <RaporButton classes={classes.map(c => ({ id: c.id, name: c.name, grade: c.grade }))} />
        </div>
      </div>

      {/* Kritik Uyarılar */}
      {(redAlerts.length > 0 || yellowAlerts.length > 0 || greenAlerts.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {redAlerts.map(a => (
            <span key={a} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {a}
            </span>
          ))}
          {yellowAlerts.map(a => (
            <span key={a} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              {a}
            </span>
          ))}
          {greenAlerts.map(a => (
            <span key={a} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard value={studentCount} label="Öğrenci" sub={`${classes.length} sınıf`} href="/siniflar"
          color="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200" />
        <StatCard value={teacherProfiles.length} label="Öğretmen"
          sub={`${profiles.filter(p => p.role === 'zumre_baskani').length} başkan`} href="/kullanicilar"
          color="border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200" />
        <StatCard value={classes.length} label="Sınıf" href="/siniflar"
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

      {/* Bu Hafta + Hızlı Erişim */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bu Hafta Önemli Olaylar */}
        <section className="lg:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bu Hafta Önemli Olaylar</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {weekMeetings.length === 0 && weekZumre.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Bu hafta planlanmış etkinlik yok.</p>
            ) : (
              <>
                {weekMeetings.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{m.title}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Okul Toplantısı · {format(parseISO(m.meeting_date), 'd MMMM')}</p>
                    </div>
                  </div>
                ))}
                {weekZumre.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{m.title}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Zümre · {m.branch} · {format(parseISO(m.meeting_date), 'd MMMM')}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        {/* Hızlı Erişim */}
        <div className="space-y-3">
          {[
            { href: '/yonetim', label: 'Toplantılar', sub: `${meetings.length} kayıt`, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
            { href: '/kullanicilar', label: 'Kullanıcılar', sub: `${profiles.length} kayıtlı`, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
            { href: '/siniflar', label: 'Sınıflar', sub: `${classes.length} sınıf`, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
            { href: '/audit', label: 'Denetim Günlüğü', sub: 'tüm değişiklikler', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>, color: 'text-gray-600 bg-gray-50 dark:bg-slate-700' },
          ].map(item => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{item.sub}</p>
              </div>
              <svg className="w-4 h-4 text-gray-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Mentör Rapor Özeti */}
      <MentorOzetiWidget entries={mentorSummary.map(([mentorId, count]) => {
        const t = profiles.find(p => p.id === mentorId)
        return { mentorId, count, name: t?.full_name, subject: t?.subject ?? undefined }
      })} />

      {/* Zümre Durumu + Öğretmen Aktivitesi */}
      <ZumreOgretmenWidget
        branches={[...allBranches].sort().map(b => ({
          name: b,
          active: recentBranches.has(b),
          lastDate: zumreMeetings.find(m => m.branch === b)?.meeting_date,
        }))}
        teachers={sortedTeachers}
        sessionMap={sessionMap}
        twoWeeksAgo={twoWeeksAgo}
      />

      {/* Pasif öğretmen uyarı bandı */}
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

      {/* Ajanda */}
      <AjandaWidget initial={allMeetings} />

      {/* Okul Ayarları */}
      <OkulAyarlari initialName={schoolName} initialCode={schoolCode} />
    </div>
  )
}
