import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { getLevel } from './BugunYoklamaWidget'

const LEVEL_STYLE = {
  Anaokulu: {
    bg:    'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900/40',
    label: 'text-pink-500 dark:text-pink-400',
    value: 'text-pink-700 dark:text-pink-300',
    sub:   'text-pink-400 dark:text-pink-600',
  },
  Ortaokul: {
    bg:    'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40',
    label: 'text-blue-500 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
    sub:   'text-blue-400 dark:text-blue-600',
  },
  Lise: {
    bg:    'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40',
    label: 'text-indigo-500 dark:text-indigo-400',
    value: 'text-indigo-700 dark:text-indigo-300',
    sub:   'text-indigo-400 dark:text-indigo-600',
  },
  Diğer: {
    bg:    'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700',
    label: 'text-gray-500 dark:text-slate-400',
    value: 'text-gray-700 dark:text-slate-300',
    sub:   'text-gray-500 dark:text-slate-400',
  },
}

export default async function OkulSeviyesiKartlari() {
  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])

  const [classesRes, studentsRes] = await Promise.all([
    supabase.from('classes').select('id, name, grade').eq('school_id', school_id).is('deleted_at', null),
    supabase.from('students').select('id, class_id').eq('school_id', school_id).is('deleted_at', null),
  ])

  const classes  = classesRes.data  ?? []
  const students = studentsRes.data ?? []

  type Level = keyof typeof LEVEL_STYLE
  const levels: Level[] = ['Anaokulu', 'Ortaokul', 'Lise']

  const grouped = levels.map(level => {
    const levelClasses = classes.filter(c => getLevel(c.name, c.grade) === level)
    const classIds     = new Set(levelClasses.map(c => c.id))
    return {
      level,
      classCount:   levelClasses.length,
      studentCount: students.filter(s => classIds.has(s.class_id)).length,
    }
  })

  const visibleLevels = grouped.filter(g => g.classCount > 0)
  if (visibleLevels.length === 0) return null

  return (
    <div className={`grid gap-3 grid-cols-${visibleLevels.length === 1 ? '1 max-w-xs' : visibleLevels.length === 2 ? '2' : '3'}`}>
      {visibleLevels.map(({ level, classCount, studentCount }) => {
        const s = LEVEL_STYLE[level]
        return (
          <div key={level} className={`border rounded-2xl p-4 ${s.bg}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${s.label}`}>
              {level}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${s.value}`}>
              {studentCount}
            </p>
            <p className={`text-xs mt-0.5 ${s.sub}`}>öğrenci</p>
            <p className={`text-xs mt-1 ${s.sub}`}>{classCount} sınıf</p>
          </div>
        )
      })}
    </div>
  )
}
