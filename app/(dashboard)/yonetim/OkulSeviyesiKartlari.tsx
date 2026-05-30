import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'
import { getLevel } from './BugunYoklamaWidget'

export default async function OkulSeviyesiKartlari() {
  const supabase   = await createClient()
  const school_id  = await requireSchoolId()
  const weekAgoStr = subDays(new Date(), 7).toISOString().split('T')[0]

  const [classesRes, studentsRes, teachersRes, homeworksRes] = await Promise.all([
    supabase.from('classes').select('id, name, grade').eq('school_id', school_id).is('deleted_at', null),
    supabase.from('students').select('id, class_id').eq('school_id', school_id).is('deleted_at', null),
    supabase.from('profiles').select('id').eq('school_id', school_id).in('role', ['ogretmen', 'zumre_baskani']),
    supabase.from('homeworks').select('teacher_id').eq('school_id', school_id)
      .gte('assigned_date', weekAgoStr).is('deleted_at', null),
  ])

  const classes  = classesRes.data  ?? []
  const students = studentsRes.data ?? []
  const teachers = teachersRes.data ?? []

  const anaOkulClassIds = new Set(
    classes.filter(c => getLevel(c.name, c.grade) === 'Anaokulu').map(c => c.id)
  )
  const anaOkulStudentCount = students.filter(s => anaOkulClassIds.has(s.class_id)).length
  const anaOkulClassCount   = anaOkulClassIds.size

  const teachersWithHomework = new Set((homeworksRes.data ?? []).map(h => h.teacher_id))
  const activeCount  = teachers.filter(t => teachersWithHomework.has(t.id)).length
  const totalTeachers = teachers.length
  const aktifRatio   = totalTeachers > 0 ? activeCount / totalTeachers : 1

  const cols = anaOkulClassCount > 0 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'

  return (
    <div className={`grid ${cols} gap-3`}>

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

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">Bu Hafta Ödev Girişi</p>
        <p className={`text-2xl font-bold tabular-nums ${
          aktifRatio === 1
            ? 'text-emerald-600 dark:text-emerald-400'
            : aktifRatio >= 0.7
              ? 'text-amber-500'
              : 'text-red-500'
        }`}>
          {activeCount}
          <span className="text-base font-normal text-gray-400 dark:text-slate-500">
            {' '}/ {totalTeachers}
          </span>
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">öğretmen girdi</p>
        <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">son 7 gün</p>
      </div>

    </div>
  )
}
