import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'
import { getLevel } from './BugunYoklamaWidget'

export default async function OkulSeviyesiKartlari() {
  const supabase    = await createClient()
  const school_id   = await requireSchoolId()
  const weekAgo     = subDays(new Date(), 7).toISOString().split('T')[0]
  const twoWeeksAgo = subDays(new Date(), 14).toISOString()

  const [classesRes, studentsRes, teachersRes, sessionsRes, homeworksRes, submissionsRes, tcRes] =
    await Promise.all([
      supabase.from('classes').select('id, name, grade').eq('school_id', school_id).is('deleted_at', null),
      supabase.from('students').select('id, class_id').eq('school_id', school_id).is('deleted_at', null),
      supabase.from('profiles').select('id').eq('school_id', school_id).in('role', ['ogretmen', 'zumre_baskani']),
      supabase.from('user_sessions').select('user_id, last_seen_at').eq('school_id', school_id),
      supabase.from('homeworks').select('teacher_id').eq('school_id', school_id).gte('assigned_date', weekAgo).is('deleted_at', null),
      supabase.from('homework_submissions').select('status').eq('school_id', school_id).gte('updated_at', weekAgo + 'T00:00:00Z'),
      supabase.from('teacher_classes').select('teacher_id, class_id').eq('school_id', school_id),
    ])

  const classes    = classesRes.data  ?? []
  const students   = studentsRes.data ?? []
  const allTeachers = teachersRes.data ?? []
  const sessions   = sessionsRes.data ?? []

  // ── Seviye ayrımı ──────────────────────────────────────────────
  const anaOkulClassIds = new Set(
    classes.filter(c => getLevel(c.name, c.grade) === 'Anaokulu').map(c => c.id)
  )
  const otherClassIds = new Set(
    classes.filter(c => getLevel(c.name, c.grade) !== 'Anaokulu').map(c => c.id)
  )

  // ── Anaokulu ────────────────────────────────────────────────────
  const anaOkulStudentCount = students.filter(s => anaOkulClassIds.has(s.class_id)).length
  const anaOkulClassCount   = anaOkulClassIds.size

  // ── KPI 1: Bu hafta ödev tamamlanma ────────────────────────────
  const submissions  = submissionsRes.data ?? []
  const totalSubs    = submissions.length
  const doneSubs     = submissions.filter(s => s.status === 'yapildi').length
  const missingSubs  = submissions.filter(s => s.status === 'yapilmadi' || s.status === 'eksik').length
  const completionRate = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : null

  // ── KPI 2: Ödev girişi — sadece ortaokul/lise öğretmenleri ─────
  const teacherClasses = tcRes.data ?? []
  const nonAnaOkulTeacherIds = new Set(
    teacherClasses.filter(tc => otherClassIds.has(tc.class_id)).map(tc => tc.teacher_id)
  )
  const relevantTeachers  = allTeachers.filter(t => nonAnaOkulTeacherIds.has(t.id))
  const enteredIds        = new Set((homeworksRes.data ?? []).map(h => h.teacher_id))
  const noHomeworkCount   = relevantTeachers.filter(t => !enteredIds.has(t.id)).length

  // ── KPI 3: Aktif öğretmen (son 14 gün) ─────────────────────────
  const lastSeenMap = new Map<string, string>()
  for (const s of sessions) {
    const prev = lastSeenMap.get(s.user_id)
    if (!prev || s.last_seen_at > prev) lastSeenMap.set(s.user_id, s.last_seen_at)
  }
  const activeTeacherCount = allTeachers.filter(t => {
    const ls = lastSeenMap.get(t.id)
    return ls && ls >= twoWeeksAgo
  }).length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

      {/* Anaokulu — ayrı stil */}
      {anaOkulClassCount > 0 && (
        <div className="bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-pink-500 dark:text-pink-400 uppercase tracking-wide mb-2">
            Anaokulu
          </p>
          <p className="text-2xl font-bold text-pink-700 dark:text-pink-300 tabular-nums">
            {anaOkulStudentCount}
          </p>
          <p className="text-xs text-pink-400 dark:text-pink-500 mt-0.5">öğrenci</p>
          <p className="text-xs text-pink-300 dark:text-pink-700 mt-1">{anaOkulClassCount} sınıf</p>
        </div>
      )}

      {/* KPI 1: Ödev tamamlanma */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">Bu Hafta Ödevler</p>
        {completionRate !== null ? (
          <>
            <p className={`text-2xl font-bold tabular-nums ${
              completionRate >= 80
                ? 'text-emerald-600 dark:text-emerald-400'
                : completionRate >= 50
                  ? 'text-amber-500'
                  : 'text-red-500'
            }`}>
              %{completionRate}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">tamamlandı</p>
            {missingSubs > 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">{missingSubs} eksik</p>
            )}
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-gray-300 dark:text-slate-600">—</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">bu hafta ödev yok</p>
          </>
        )}
      </div>

      {/* KPI 2: Ödev girişi */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">Ödev Girişi</p>
        <p className={`text-2xl font-bold tabular-nums ${
          noHomeworkCount > 0 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
        }`}>
          {noHomeworkCount}
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
          {noHomeworkCount === 0 ? 'herkes girdi' : 'öğretmen girmedi'}
        </p>
        <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">son 7 gün</p>
      </div>

      {/* KPI 3: Aktif öğretmen */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">Aktif Öğretmen</p>
        <p className={`text-2xl font-bold tabular-nums ${
          activeTeacherCount === allTeachers.length
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-amber-500'
        }`}>
          {activeTeacherCount}
          <span className="text-base font-normal text-gray-400 dark:text-slate-500">
            {' '}/ {allTeachers.length}
          </span>
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">aktif</p>
        <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">son 14 gün</p>
      </div>

    </div>
  )
}
