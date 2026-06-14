import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { schoolYearStart } from '@/src/shared/utils'
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import { ATTENDANCE_WARN_DAYS } from '@/src/shared/constants/attendance'

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
  const todayStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

  const [classesRes, attendanceRes, yearRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade')
      .eq('school_id', school_id)
      .is('deleted_at', null),
    supabase
      .from('attendance')
      .select('class_id, status, teacher_id, created_at')
      .eq('school_id', school_id)
      .eq('date', todayStr),
    supabase
      .from('attendance')
      .select('student_id, status, date, students(full_name, deleted_at)')
      .eq('school_id', school_id)
      .gte('date', schoolYearStart())
      .in('status', ['absent', 'late'])
      .limit(10000),
  ])

  const classes    = classesRes.data ?? []
  const attendance = attendanceRes.data ?? []

  // Kimin yoklama aldığı — class_id → ilk teacher
  const takerByClass = new Map<string, { teacherId: string; at: string }>()
  for (const a of attendance) {
    if (!takerByClass.has(a.class_id)) {
      takerByClass.set(a.class_id, { teacherId: a.teacher_id, at: a.created_at })
    }
  }
  const teacherIds = [...new Set([...takerByClass.values()].map(t => t.teacherId))]
  const { data: teacherProfiles } = teacherIds.length
    ? await supabase.from('profiles').select('id, full_name').eq('school_id', school_id).in('id', teacherIds)
    : { data: [] }
  const teacherName = new Map((teacherProfiles ?? []).map(p => [p.id, p.full_name]))

  // Limit yaklaşan öğrenciler (özürsüz >= 15 gün)
  type YearRow = { student_id: string; status: string; date: string; students: { full_name: string; deleted_at: string | null } | null }
  const yearRows = ((yearRes.data ?? []) as YearRow[]).filter(r => r.students && !r.students.deleted_at)
  const counts = countAbsences(yearRows)
  const nameByStudent = new Map(yearRows.map(r => [r.student_id, r.students!.full_name]))
  const atRisk = Object.entries(counts)
    .filter(([, c]) => c.unexcused >= ATTENDANCE_WARN_DAYS)
    .sort((a, b) => b[1].unexcused - a[1].unexcused)
    .slice(0, 8)

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
              <Link
                key={c.id}
                href={`/yoklama?sinif=${c.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-600 hover:text-blue-700 transition-colors"
              >
                {c.name}
                <span className={`text-[10px] px-1 py-0.5 rounded ${LEVEL_COLOR[getLevel(c.name, c.grade)]}`}>
                  {getLevel(c.name, c.grade)}
                </span>
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {missingClasses.length === 0 && totalClasses > 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          Tüm sınıflarda yoklama girildi.
        </p>
      )}

      {takerByClass.size > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Alınan yoklamalar</p>
          <div className="flex flex-wrap gap-1.5">
            {classes.filter(c => takerByClass.has(c.id)).map(c => {
              const t = takerByClass.get(c.id)!
              const saat = new Date(t.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
              return (
                <span key={c.id} className="text-[11px] px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                  {c.name} · {teacherName.get(t.teacherId) ?? '—'} · {saat}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {atRisk.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Devamsızlık sınırına yaklaşanlar (özürsüz ≥ {ATTENDANCE_WARN_DAYS} gün)</p>
          <ul className="space-y-1">
            {atRisk.map(([id, c]) => (
              <li key={id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-slate-300">{nameByStudent.get(id) ?? '—'}</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{c.unexcused} gün</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
