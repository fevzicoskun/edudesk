import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { getLevel } from './BugunYoklamaWidget'

type Level = 'Anaokulu' | 'Ortaokul' | 'Lise' | 'Diğer'

const LEVEL_CONFIG: Record<Level, { gradient: string; icon: string }> = {
  Anaokulu: { gradient: 'from-pink-500 to-purple-500',  icon: '🌸' },
  Ortaokul: { gradient: 'from-blue-500 to-cyan-500',    icon: '📚' },
  Lise:     { gradient: 'from-indigo-500 to-violet-500', icon: '🎓' },
  Diğer:    { gradient: 'from-gray-500 to-slate-500',   icon: '🏫' },
}

export default async function OkulSeviyesiKartlari() {
  const supabase   = await createClient()
  const school_id  = await requireSchoolId()

  const [classesRes, studentsRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade')
      .eq('school_id', school_id)
      .is('deleted_at', null),
    supabase
      .from('students')
      .select('id, class_id')
      .eq('school_id', school_id)
      .is('deleted_at', null),
  ])

  const classes  = classesRes.data  ?? []
  const students = studentsRes.data ?? []

  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  const levels: Level[] = ['Anaokulu', 'Ortaokul', 'Lise']
  const stats = levels.map(level => {
    const levelClasses = classes.filter(c => getLevel(c.name, c.grade) === level)
    const studentCount = levelClasses.reduce((sum, c) => sum + (studentsByClass.get(c.id) ?? 0), 0)
    return { level, classCount: levelClasses.length, studentCount }
  })

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Kademeler</h2>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ level, classCount, studentCount }) => {
          const cfg = LEVEL_CONFIG[level]
          return (
            <div
              key={level}
              className={`rounded-2xl p-4 bg-gradient-to-br ${cfg.gradient} shadow-md text-white`}
            >
              <div className="text-2xl mb-1">{cfg.icon}</div>
              <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">{level}</p>
              <p className="text-3xl font-bold leading-none mt-2 tabular-nums">{studentCount}</p>
              <p className="text-xs text-white/75 mt-1">öğrenci</p>
              <p className="text-xs text-white/60 mt-0.5">{classCount} sınıf</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
