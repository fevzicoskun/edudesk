import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'

export function getLevel(name: string, grade: number | null): 'Anaokulu' | 'Ortaokul' | 'Lise' | 'Diğer' {
  const n = name.toLowerCase()
  if (n.includes('anaokul') || n.includes('hazırlık')) return 'Anaokulu'
  if (grade && grade >= 9) return 'Lise'
  if (grade && grade >= 5) return 'Ortaokul'
  return 'Diğer'
}

const LEVEL_COLOR: Record<ReturnType<typeof getLevel>, string> = {
  Anaokulu: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  Ortaokul: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  Lise:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  Diğer:    'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

export default async function BugunYoklamaWidget() {
  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const _d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${_d.getFullYear()}-${pad(_d.getMonth() + 1)}-${pad(_d.getDate())}`

  const [classesRes, attendanceRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade')
      .eq('school_id', school_id)
      .is('deleted_at', null),
    supabase
      .from('attendance')
      .select('class_id, status')
      .eq('school_id', school_id)
      .eq('date', todayStr),
  ])

  const classes     = classesRes.data ?? []
  const attendance  = attendanceRes.data ?? []

  const classesWithAttendance = new Set(attendance.map(a => a.class_id))
  const absentCount           = attendance.filter(a => a.status === 'absent').length
  const totalClasses          = classes.length
  const completedCount        = classes.filter(c => classesWithAttendance.has(c.id)).length
  const missingClasses        = classes.filter(c => !classesWithAttendance.has(c.id))

  const ratio     = totalClasses > 0 ? completedCount / totalClasses : 1
  const pillColor = ratio === 1
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
    : ratio >= 0.5
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
      : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25'

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Bugün</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${pillColor}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          Yoklama: {completedCount} / {totalClasses} sınıf tamamlandı
        </span>
        {absentCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {absentCount} devamsız öğrenci
          </span>
        )}
      </div>

      {missingClasses.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Yoklama girilmemiş sınıflar</p>
          <div className="flex flex-wrap gap-1.5">
            {missingClasses.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                {c.name}
                <span className={`text-[10px] px-1 py-0.5 rounded ${LEVEL_COLOR[getLevel(c.name, c.grade)]}`}>
                  {getLevel(c.name, c.grade)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {missingClasses.length === 0 && totalClasses > 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          Tüm sınıflarda yoklama girildi.
        </p>
      )}
    </div>
  )
}
