import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'
import { schoolYearStart } from '@/src/shared/utils'
import { ATTENDANCE_WARN_DAYS } from '@/src/shared/constants/attendance'
import {
  computeAttendanceKpi,
  computeClassAbsence,
  computeWeeklyAbsenceTrend,
  computeChronicAbsentees,
  computeCoverage,
  type AbsenceRowA,
  type StudentA,
  type ClassA,
  type CoverageRpcRow,
} from '@/src/domains/attendance/lib/analitik'
import KpiOzet from './KpiOzet'
import SinifTrend from './SinifTrend'
import KronikSicil from './KronikSicil'
import SinifKapsama from './SinifKapsama'

export const revalidate = 30

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const istanbulISO = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)

export const metadata = { title: 'Yoklama Analitiği' }

export default async function YoklamaAnalitikPage() {
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) redirect('/login')

  if (!(isTeachingRole(profile.role) || isMudurOrAbove(profile.role))) redirect('/yoklama')

  const sid = profile.school_id
  const isManager = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  const canSeeCoverage = isMudurOrAbove(profile.role)
  const supabase = await createClient()

  // Öğretmen → yalnız kendi sınıfları
  let myClassIds: string[] | null = null
  if (!isManager) {
    const { data: tc } = await supabase.from('teacher_classes').select('class_id').eq('teacher_id', user.id)
    myClassIds = [...new Set((tc ?? []).map(r => r.class_id))]
  }

  // classes
  let classQuery = supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', sid)
    .is('deleted_at', null)
    .order('grade')
    .order('name')
  if (myClassIds) classQuery = classQuery.in('id', myClassIds.length ? myClassIds : [NO_MATCH])
  const { data: classData } = await classQuery
  const classes = (classData ?? []) as ClassA[]
  const classIds = classes.map(c => c.id)

  const yearStart = schoolYearStart()
  const todayISO = istanbulISO(new Date())

  // students + absence rows + bugün alınan (present filtresiz distinct class_id)
  const [studentRes, absRes, todayRes] = classIds.length
    ? await Promise.all([
        supabase.from('students').select('id, class_id, full_name, student_number').in('class_id', classIds).eq('school_id', sid).is('deleted_at', null),
        supabase.from('attendance').select('student_id, status, date').eq('school_id', sid).in('class_id', classIds).in('status', ['absent', 'late', 'excused']).gte('date', yearStart),
        supabase.from('attendance').select('class_id').eq('school_id', sid).in('class_id', classIds).eq('date', todayISO),
      ])
    : ([{ data: [] as StudentA[] }, { data: [] as AbsenceRowA[] }, { data: [] as { class_id: string }[] }] as const)

  const students = (studentRes.data ?? []) as StudentA[]
  const rows = (absRes.data ?? []) as AbsenceRowA[]
  const takenToday = new Set((todayRes.data ?? []).map(r => (r as { class_id: string }).class_id)).size

  const kpi = computeAttendanceKpi(rows, students, takenToday, classes.length)
  const classStats = computeClassAbsence(rows, students, classes)
  const trend = computeWeeklyAbsenceTrend(rows, students.length, 8)
  const chronic = computeChronicAbsentees(rows, students, classes, ATTENDANCE_WARN_DAYS)

  let coverage: CoverageRpcRow[] = []
  if (canSeeCoverage) {
    const since = istanbulISO(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const { data: covData } = await supabase.rpc('get_class_attendance_coverage', { p_school_id: sid, p_since: since })
    coverage = (covData ?? []).map(r => ({ class_id: r.class_id, covered_days: Number(r.covered_days) }))
  }
  const coverageStats = computeCoverage(coverage, classes)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama Analitiği</h1>
        <Link href="/yoklama" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
          ← Yoklama
        </Link>
      </div>
      <KpiOzet kpi={kpi} />
      <SinifTrend classStats={classStats} trend={trend} />
      <KronikSicil items={chronic} />
      {canSeeCoverage && <SinifKapsama items={coverageStats} />}
    </div>
  )
}
