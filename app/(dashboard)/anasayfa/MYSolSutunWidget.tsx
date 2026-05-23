import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import Link from 'next/link'
import { subDays } from '@/src/shared/date'

export default async function MYSolSutunWidget() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()

  const today         = new Date()
  const todayStr      = today.toISOString().split('T')[0]
  const twoWeeksAgo   = subDays(today, 14).toISOString()
  const thirtyDaysAgo = subDays(today, 30).toISOString().split('T')[0]

  const [studentsRes, absent30Res, classesRes, profilesRes, sessionsRes] = await Promise.all([
    supabase.from('students').select('id, full_name, class_id').eq('school_id', school_id).is('deleted_at', null),
    supabase.from('attendance').select('student_id').eq('school_id', school_id).eq('status', 'absent').gte('date', thirtyDaysAgo),
    supabase.from('classes').select('id, name, grade').eq('school_id', school_id).order('grade').order('name'),
    supabase.from('profiles').select('id, full_name, subject, role').eq('school_id', school_id).in('role', ['ogretmen', 'zumre_baskani']).order('full_name'),
    supabase.from('user_sessions').select('user_id, last_seen_at').eq('school_id', school_id),
  ])

  const students = studentsRes.data ?? []
  const classes  = classesRes.data  ?? []
  const teachers = profilesRes.data ?? []

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

  const sessionMap = new Map<string, string>()
  for (const s of sessionsRes.data ?? []) {
    const prev = sessionMap.get(s.user_id)
    if (!prev || s.last_seen_at > prev) sessionMap.set(s.user_id, s.last_seen_at)
  }

  return (
    <div className="space-y-4">
      <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Devamsızlık Riski</h2>
          <span className="text-[11px] text-gray-400 dark:text-slate-500">son 30 gün &middot; 5+ devamsız</span>
        </div>
        {riskStudents.length === 0 ? (
          <p className="px-4 py-7 text-center text-sm text-gray-400 dark:text-slate-500">Riskli öğrenci yok.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {riskStudents.map(s => {
              const cls    = classMap.get(s.class_id)
              const danger = s.absences >= 10
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${danger ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{s.full_name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">{cls?.name ?? '—'}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${danger ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'}`}>
                    {s.absences} gün
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Öğretmenler</h2>
          <Link href="/kullanicilar" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Yönet →</Link>
        </div>
        {teachers.length === 0 ? (
          <p className="px-4 py-7 text-center text-sm text-gray-400 dark:text-slate-500">Henüz öğretmen yok.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {teachers.slice(0, 12).map(t => {
              const lastSeen = sessionMap.get(t.id)
              const inactive = !lastSeen || lastSeen < twoWeeksAgo
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${inactive ? 'bg-red-400' : 'bg-emerald-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{t.full_name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">
                      {t.subject ?? '—'}
                      {lastSeen && <> · {new Date(lastSeen).toLocaleDateString('tr-TR')}</>}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${inactive ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                    {inactive ? 'Pasif' : 'Aktif'}
                  </span>
                </li>
              )
            })}
            {teachers.length > 12 && (
              <li className="px-4 py-2.5 text-center">
                <Link href="/kullanicilar" className="text-xs text-indigo-500 hover:underline">
                  +{teachers.length - 12} daha göster →
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
