import { createClient } from '@/lib/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import Link from 'next/link'
import { format, subDays } from '@/src/shared/date'
import AjandaWidget from './AjandaWidget'
import MYSolSutunWidget from './MYSolSutunWidget'

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

export default async function MudurYardimcisiDashboard({ fullName }: { fullName: string }) {
  const supabase = await createClient()
  const school_id = await requireSchoolId()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const thirtyDaysAgo = subDays(today, 30).toISOString().split('T')[0]
  const twoWeeksAgo   = subDays(today, 14).toISOString()

  const [profilesRes, classesRes, studentsRes, todayAttRes, absent30Res, meetingsRes, sessionsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, subject, role')
      .eq('school_id', school_id)
      .in('role', ['ogretmen', 'zumre_baskani'])
      .order('full_name'),
    supabase
      .from('classes')
      .select('id, name, grade')
      .eq('school_id', school_id)
      .order('grade').order('name'),
    supabase
      .from('students')
      .select('id, full_name, class_id')
      .eq('school_id', school_id),
    supabase
      .from('attendance')
      .select('class_id, student_id, status')
      .eq('school_id', school_id)
      .eq('date', todayStr),
    supabase
      .from('attendance')
      .select('student_id')
      .eq('school_id', school_id)
      .eq('status', 'absent')
      .gte('date', thirtyDaysAgo),
    supabase
      .from('school_meetings')
      .select('id, title, meeting_date, meeting_type, attendees, notes')
      .eq('school_id', school_id)
      .order('meeting_date', { ascending: false }),
    supabase
      .from('user_sessions')
      .select('user_id, last_seen_at')
      .eq('school_id', school_id),
  ])
  const teachers  = profilesRes.data ?? []
  const classes   = classesRes.data   ?? []
  const students  = studentsRes.data  ?? []
  const meetings  = meetingsRes.data  ?? []

  // Oturum verileri — school_id ile paralel çekildi, öğretmen filtresi burada
  const teacherIds = teachers.map(t => t.id)
  const teacherIdSet = new Set(teacherIds)
  const sessionMap = new Map<string, string>()
  for (const s of sessionsRes.data ?? []) {
    if (!teacherIdSet.has(s.user_id)) continue
    const prev = sessionMap.get(s.user_id)
    if (!prev || s.last_seen_at > prev) sessionMap.set(s.user_id, s.last_seen_at)
  }

  // ─── Bugün istatistikleri ─────────────────────────────────────────
  const todayAtt = todayAttRes.data ?? []
  const classesWithAtt = new Set(todayAtt.map(a => a.class_id))
  const todayAbsent = todayAtt.filter(a => a.status === 'absent').length

  // ─── Devamsızlık riski (son 30 gün ≥ 5 devamsız — sadece absent çekildi) ─────
  const absenceMap = new Map<string, number>()
  for (const a of absent30Res.data ?? []) {
    absenceMap.set(a.student_id, (absenceMap.get(a.student_id) ?? 0) + 1)
  }
  const riskStudents = students
    .map(s => ({ ...s, absences: absenceMap.get(s.id) ?? 0 }))
    .filter(s => s.absences >= 5)
    .sort((a, b) => b.absences - a.absences)
    .slice(0, 10)

  const classMap = new Map(classes.map(c => [c.id, c]))

  // ─── Öğretmen aktiflik ───────────────────────────────────────────
  const activeCount   = teachers.filter(t => (sessionMap.get(t.id) ?? '') >= twoWeeksAgo).length
  const inactiveCount = teachers.length - activeCount

  // ─── Uyarılar ────────────────────────────────────────────────────
  const alerts: { text: string; type: AlertType }[] = []
  const missingAtt = classes.length - classesWithAtt.size
  if (missingAtt > 0 && classes.length > 0)
    alerts.push({ text: `${missingAtt} sınıf yoklaması girilmemiş`, type: 'yellow' })
  if (todayAbsent >= 5)
    alerts.push({ text: `Bugün ${todayAbsent} devamsız öğrenci`, type: 'red' })
  else if (todayAbsent > 0)
    alerts.push({ text: `Bugün ${todayAbsent} devamsız öğrenci`, type: 'yellow' })
  if (riskStudents.length > 0)
    alerts.push({ text: `${riskStudents.length} öğrenci devamsızlık sınırına yakın`, type: 'yellow' })
  if (inactiveCount > 0)
    alerts.push({ text: `${inactiveCount} öğretmen 2 haftadır giriş yapmadı`, type: 'yellow' })
  if (alerts.length === 0)
    alerts.push({ text: 'Tüm operasyonel göstergeler normal', type: 'green' })

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* ─── Başlık ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yönetim Paneli</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {fullName} · {format(today, 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {/* ─── Alert şeridi ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {alerts.map((a, i) => (
          <span key={i} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${ALERT_RING[a.type]}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ALERT_DOT[a.type]}`} />
            {a.text}
          </span>
        ))}
      </div>

      {/* ─── 3 Stat kartı ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 ${statColor(classesWithAtt.size >= classes.length && classes.length > 0, false)}`}>
          <p className="text-3xl font-bold leading-none">
            {classesWithAtt.size}
            <span className="text-base font-medium opacity-60">/{classes.length}</span>
          </p>
          <p className="text-sm font-medium mt-1.5">Yoklama Alınan Sınıf</p>
          <p className="text-[11px] opacity-70 mt-0.5">bugün</p>
        </div>

        <div className={`rounded-xl border p-4 ${statColor(todayAbsent === 0, todayAbsent >= 5)}`}>
          <p className="text-3xl font-bold leading-none">{todayAbsent}</p>
          <p className="text-sm font-medium mt-1.5">Devamsız Öğrenci</p>
          <p className="text-[11px] opacity-70 mt-0.5">bugün · {students.length} toplam</p>
        </div>

        <div className={`rounded-xl border p-4 ${statColor(inactiveCount === 0, false)}`}>
          <p className="text-3xl font-bold leading-none">
            {activeCount}
            <span className="text-base font-medium opacity-60">/{teachers.length}</span>
          </p>
          <p className="text-sm font-medium mt-1.5">Aktif Öğretmen</p>
          <p className="text-[11px] opacity-70 mt-0.5">son 2 hafta içinde giriş</p>
        </div>
      </div>

      {/* ─── Ana içerik: sol listeler + sağ ajanda ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Sol sütun */}
        <MYSolSutunWidget
          riskStudents={riskStudents}
          classMap={classMap}
          teachers={teachers}
          sessionMap={sessionMap}
          twoWeeksAgo={twoWeeksAgo}
        />

        {/* Sağ sütun — İnteraktif Ajanda */}
        <AjandaWidget initial={meetings} />
      </div>

      {/* ─── Hızlı Erişim ──────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Hızlı Erişim</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            {
              href: '/siniflar', label: 'Sınıf Listeleri',
              color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
            },
            {
              href: '/yoklama', label: 'Yoklama Girişi',
              color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
            },
            {
              href: '/raporlar', label: 'Raporlar',
              color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
            },
            {
              href: '/ders-programi', label: 'Ders Programları',
              color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
            },
            {
              href: '/siniflar', label: 'Mentör Atamaları',
              color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
            },
            {
              href: '/kullanicilar', label: 'Kullanıcı Yönetimi',
              color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
            },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                {item.icon}
              </div>
              <span className="text-xs font-medium text-gray-800 dark:text-slate-200">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
