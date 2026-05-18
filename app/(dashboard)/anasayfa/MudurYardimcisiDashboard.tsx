import { createClient } from '@/lib/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import Link from 'next/link'
import { format, parseISO, subDays, addDays } from '@/src/shared/date'
import { ROLE_LABELS, type Role } from '@/src/shared/types'
import RaporButton from '@/components/RaporButton'

const DONE_STATUSES = new Set(['yapildi', 'gec'])

export default async function MudurYardimcisiDashboard({ fullName }: { fullName: string }) {
  const supabase = await createClient()
  const school_id = await requireSchoolId()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekEnd = addDays(today, 7).toISOString().split('T')[0]
  const twoWeeksAgo = subDays(today, 14).toISOString()

  const [profilesRes, classesRes, studentsRes, homeworksRes, submissionsRes, attendanceRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, subject, role').eq('school_id', school_id).in('role', ['ogretmen', 'zumre_baskani']).order('full_name'),
    supabase.from('classes').select('id, name, grade').eq('school_id', school_id).order('grade').order('name'),
    supabase.from('students').select('id, full_name, class_id').eq('school_id', school_id),
    supabase.from('homeworks').select('id, title, subject, due_date, class_id, teacher_id').eq('school_id', school_id).order('due_date'),
    supabase.from('homework_submissions').select('homework_id, student_id, status').eq('school_id', school_id),
    supabase.from('attendance').select('class_id, student_id, date, status').eq('school_id', school_id).gte('date', subDays(today, 30).toISOString().split('T')[0]),
  ])

  const teachers = profilesRes.data ?? []
  const classes = classesRes.data ?? []
  const students = studentsRes.data ?? []
  const homeworks = homeworksRes.data ?? []
  const submissions = submissionsRes.data ?? []
  const attendance = attendanceRes.data ?? []

  const teacherIds = teachers.map(t => t.id)
  const { data: sessionsData } = teacherIds.length
    ? await supabase.from('user_sessions').select('user_id, login_at, last_seen_at, duration_minutes').in('user_id', teacherIds)
    : { data: [] }
  const sessions = sessionsData ?? []

  // ─── Yoklama bugün ───────────────────────────────────────────────
  const todayAttendance = attendance.filter(a => a.date === todayStr)
  const classesWithTodayAttendance = new Set(todayAttendance.map(a => a.class_id))
  const classesCompletedToday = classesWithTodayAttendance.size
  const todayAbsent = todayAttendance.filter(a => a.status === 'absent').length

  // ─── Ödevler ────────────────────────────────────────────────────
  const overdueHomeworks = homeworks.filter(h => h.due_date < todayStr)
  const thisWeekHomeworks = homeworks.filter(h => h.due_date >= todayStr && h.due_date <= weekEnd)

  const subMap = new Map<string, string>()
  for (const s of submissions) subMap.set(`${s.homework_id}:${s.student_id}`, s.status)

  const hwByClass = new Map<string, string[]>()
  for (const h of homeworks) {
    const arr = hwByClass.get(h.class_id) ?? []
    arr.push(h.id)
    hwByClass.set(h.class_id, arr)
  }

  // ─── Öğretmen aktivitesi ────────────────────────────────────────
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

  const inactiveTeachers = teachers.filter(t => {
    const ls = sessionMap.get(t.id)?.lastSeen
    return !ls || ls < twoWeeksAgo
  })

  const hwByTeacher = new Map<string, number>()
  for (const h of homeworks) hwByTeacher.set(h.teacher_id, (hwByTeacher.get(h.teacher_id) ?? 0) + 1)

  // ─── Devamsızlık riski: son 30 günde 5+ devamsız ─────────────────
  const absenceMap = new Map<string, number>()
  for (const a of attendance) {
    if (a.status === 'absent') absenceMap.set(a.student_id, (absenceMap.get(a.student_id) ?? 0) + 1)
  }
  const riskStudents = students
    .map(s => ({ ...s, absences: absenceMap.get(s.id) ?? 0 }))
    .filter(s => s.absences >= 5)
    .sort((a, b) => b.absences - a.absences)
    .slice(0, 10)

  // ─── Per-student ödev tamamlama ─────────────────────────────────
  type StudentStat = { id: string; full_name: string; class_id: string; assigned: number; done: number; incomplete: number }
  const studentStats: StudentStat[] = students.map(s => {
    const classHws = hwByClass.get(s.class_id) ?? []
    let done = 0, incomplete = 0
    for (const hwId of classHws) {
      const status = subMap.get(`${hwId}:${s.id}`)
      if (!status) { incomplete++; continue }
      if (DONE_STATUSES.has(status)) done++
      else incomplete++
    }
    return { id: s.id, full_name: s.full_name, class_id: s.class_id, assigned: classHws.length, done, incomplete }
  })

  const classMap = new Map(classes.map(c => [c.id, c]))

  const totalHw = homeworks.length
  const totalDone = submissions.filter(s => DONE_STATUSES.has(s.status)).length
  const doneRate = submissions.length > 0 ? Math.round((totalDone / submissions.length) * 100) : null

  // ─── Alerts ─────────────────────────────────────────────────────
  const redAlerts: string[] = []
  const yellowAlerts: string[] = []
  const greenAlerts: string[] = []

  if (todayAbsent > 0) yellowAlerts.push(`Bugün ${todayAbsent} devamsız öğrenci`)
  if (classesCompletedToday < classes.length && classes.length > 0)
    yellowAlerts.push(`${classes.length - classesCompletedToday} sınıf yoklaması eksik`)
  if (overdueHomeworks.length >= 5) redAlerts.push(`${overdueHomeworks.length} ödev vadesi geçmiş`)
  else if (overdueHomeworks.length > 0) yellowAlerts.push(`${overdueHomeworks.length} ödev vadesi geçmiş`)
  if (riskStudents.length > 0) yellowAlerts.push(`${riskStudents.length} öğrenci devamsızlık riskinde`)
  if (inactiveTeachers.length > 0) yellowAlerts.push(`${inactiveTeachers.length} öğretmen pasif`)
  if (redAlerts.length === 0 && yellowAlerts.length === 0) greenAlerts.push('Her şey yolunda görünüyor')

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Başlık */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Operasyonel Panel</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {fullName} · {format(today, 'd MMMM yyyy, EEEE')}
          </p>
        </div>
        <RaporButton classes={classes.map(c => ({ id: c.id, name: c.name, grade: c.grade }))} />
      </div>

      {/* Alert bar */}
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

      {/* Bugünkü Operasyonel Durum */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 ${classesCompletedToday >= classes.length && classes.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
          <p className="text-2xl sm:text-3xl font-bold">{classesCompletedToday}<span className="text-base font-medium opacity-60">/{classes.length}</span></p>
          <p className="text-xs sm:text-sm font-medium mt-1">Yoklama Alınan Sınıf</p>
          <p className="text-[11px] opacity-70 mt-0.5">bugün</p>
        </div>
        <div className={`rounded-xl border p-4 ${todayAbsent === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : todayAbsent >= 5 ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
          <p className="text-2xl sm:text-3xl font-bold">{todayAbsent}</p>
          <p className="text-xs sm:text-sm font-medium mt-1">Bugünkü Devamsız</p>
          <p className="text-[11px] opacity-70 mt-0.5">öğrenci sayısı</p>
        </div>
        <div className={`rounded-xl border p-4 ${overdueHomeworks.length === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : overdueHomeworks.length >= 5 ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
          <p className="text-2xl sm:text-3xl font-bold">{overdueHomeworks.length}</p>
          <p className="text-xs sm:text-sm font-medium mt-1">Geciken Ödev</p>
          <p className="text-[11px] opacity-70 mt-0.5">{doneRate !== null ? `%${doneRate} tamamlanan` : 'veri yok'}</p>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 p-3 sm:p-4">
          <p className="text-2xl sm:text-3xl font-bold">{teachers.length}</p>
          <p className="text-xs sm:text-sm font-medium mt-1">Öğretmen</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200 p-3 sm:p-4">
          <p className="text-2xl sm:text-3xl font-bold">{students.length}</p>
          <p className="text-xs sm:text-sm font-medium mt-1">Öğrenci</p>
          <p className="text-[11px] opacity-70 mt-0.5">{classes.length} sınıf</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 p-3 sm:p-4">
          <p className="text-2xl sm:text-3xl font-bold">{totalHw}</p>
          <p className="text-xs sm:text-sm font-medium mt-1">Toplam Ödev</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200 p-3 sm:p-4">
          <p className="text-2xl sm:text-3xl font-bold">{thisWeekHomeworks.length}</p>
          <p className="text-xs sm:text-sm font-medium mt-1">Bu Hafta Teslim</p>
        </div>
      </div>

      {/* Ana içerik: ödevler + devamsızlık riski */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Geciken + Bu Hafta Ödevler */}
        <div className="space-y-4">
          {/* Geciken ödevler */}
          <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Geciken Ödevler</h2>
              <Link href="/odevler" className="text-xs text-blue-600 font-medium hover:underline">Tümü →</Link>
            </div>
            {overdueHomeworks.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-gray-400">Geciken ödev yok.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                {overdueHomeworks.slice(0, 6).map(h => {
                  const cls = classMap.get(h.class_id)
                  const teacher = teachers.find(t => t.id === h.teacher_id)
                  const daysLate = Math.floor((today.getTime() - new Date(h.due_date).getTime()) / 86400000)
                  return (
                    <li key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${daysLate >= 7 ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{h.title}</p>
                        <p className="text-[11px] text-gray-400">{cls?.name ?? '—'} · {teacher?.full_name ?? '—'}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${daysLate >= 7 ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'}`}>
                        {daysLate}g geç
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Bu hafta teslim */}
          <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bu Hafta Teslim Edilecek</h2>
            </div>
            {thisWeekHomeworks.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-gray-400">Bu hafta teslim yoktu.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                {thisWeekHomeworks.map(h => {
                  const cls = classMap.get(h.class_id)
                  const teacher = teachers.find(t => t.id === h.teacher_id)
                  return (
                    <li key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{h.title}</p>
                        <p className="text-[11px] text-gray-400">{cls?.name ?? '—'} · {teacher?.full_name ?? '—'}</p>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 shrink-0">
                        {format(parseISO(h.due_date), 'd MMM')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Sağ sütun: devamsızlık riski + öğrenci tamamlama */}
        <div className="space-y-4">
          {/* Devamsızlık Riski */}
          <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Devamsızlık Riski (Son 30 Gün)</h2>
            </div>
            {riskStudents.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-gray-400">Riskli öğrenci yok.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                {riskStudents.map(s => {
                  const cls = classMap.get(s.class_id)
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.absences >= 10 ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-slate-100">{s.full_name}</p>
                        <p className="text-[11px] text-gray-400">{cls?.name ?? '—'}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${s.absences >= 10 ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'}`}>
                        {s.absences} gün
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Sınıf ödev tamamlama özeti */}
          {classes.length > 0 && (
            <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Sınıf Ödev Tamamlama</h2>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                {classes.map(cls => {
                  const clsHws = hwByClass.get(cls.id) ?? []
                  if (clsHws.length === 0) return null
                  const clsStudents = studentStats.filter(s => s.class_id === cls.id)
                  const totalAssigned = clsStudents.reduce((a, s) => a + s.assigned, 0)
                  const totalDoneC = clsStudents.reduce((a, s) => a + s.done, 0)
                  const rate = totalAssigned > 0 ? Math.round((totalDoneC / totalAssigned) * 100) : 0
                  return (
                    <li key={cls.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-800 dark:text-slate-200">{cls.name}</span>
                        <span className="text-[11px] text-gray-500 dark:text-slate-400">%{rate}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* Öğretmen takibi */}
      <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Öğretmen Takibi</h2>
          <Link href="/kullanicilar" className="text-xs text-indigo-600 font-medium hover:underline">Yönet →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Öğretmen</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Branş</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Ödev</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Son Giriş</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {teachers.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Henüz öğretmen yok.</td></tr>
              ) : [...teachers].sort((a, b) => (hwByTeacher.get(b.id) ?? 0) - (hwByTeacher.get(a.id) ?? 0)).map(t => {
                const stats = sessionMap.get(t.id)
                const inactive = !stats?.lastSeen || stats.lastSeen < twoWeeksAgo
                const hwCount = hwByTeacher.get(t.id) ?? 0
                return (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-slate-100 text-sm">{t.full_name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 hidden sm:table-cell">{t.subject ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${hwCount === 0 ? 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500' : hwCount >= 4 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                        {hwCount}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 hidden md:table-cell">
                      {stats?.lastSeen ? new Date(stats.lastSeen).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${inactive ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                        {inactive ? 'Pasif' : 'Aktif'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hızlı Erişim */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Hızlı Erişim</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/siniflar', label: 'Sınıf Listeleri', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
            { href: '/yoklama', label: 'Yoklama Girişi', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
            { href: '/kullanicilar', label: 'Kullanıcı Yönetimi', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
            { href: '/audit', label: 'Denetim Günlüğü', color: 'text-gray-600 bg-gray-50 dark:bg-slate-700', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
          ].map(item => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>{item.icon}</div>
              <span className="text-xs font-medium text-gray-800 dark:text-slate-200">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
