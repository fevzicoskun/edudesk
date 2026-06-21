import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'
import {
  computeKpiCards,
  computeRiskyStudents,
  computeClassStats,
  computeWeeklyTrend,
  computeClassWeekHeatmap,
  computeTeacherStats,
  type AnalitikHomework,
  type AnalitikSubmission,
  type AnalitikStudent,
  type TeacherStat,
} from '@/src/domains/homework/lib/analitik'
import AnalitikOzet from './AnalitikOzet'
import BasariHeatmap from './BasariHeatmap'
import SinifDetay from './SinifDetay'
import OgrenciSicil from './OgrenciSicil'
import OgretmenKarsilastirma from './OgretmenKarsilastirma'

export const revalidate = 30

export const metadata = { title: 'Ödev Analitiği' }

export default async function AnalitikPage() {
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) redirect('/login')

  const canAccess = isTeachingRole(profile.role) || isMudurOrAbove(profile.role)
  if (!canAccess) redirect('/odevler')

  const sid       = profile.school_id
  const isManager = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  const supabase  = await createClient()

  let hwQuery = supabase
    .from('homeworks')
    .select('id, class_id, teacher_id, due_date, title')
    .eq('school_id', sid)
    .is('deleted_at', null)
    .eq('is_template', false)

  if (!isManager) hwQuery = hwQuery.eq('teacher_id', user.id)

  const [classesRes, homeworksRes] = await Promise.all([
    supabase.from('classes').select('id, name, grade').eq('school_id', sid).is('deleted_at', null).order('grade').order('name'),
    hwQuery,
  ])

  const homeworks  = (homeworksRes.data ?? []) as AnalitikHomework[]
  const classIds   = [...new Set(homeworks.map(h => h.class_id))]
  const hwIds      = homeworks.map(h => h.id)

  const [submissionsRes, studentsRes] = await Promise.all([
    hwIds.length > 0
      ? supabase
          .from('homework_submissions')
          .select('homework_id, student_id, status')
          .in('homework_id', hwIds)
          .eq('school_id', sid)
      : Promise.resolve({ data: [] as { homework_id: string; student_id: string; status: string }[] }),
    classIds.length > 0
      ? supabase
          .from('students')
          .select('id, class_id, full_name, student_number')
          .in('class_id', classIds)
          .eq('school_id', sid)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as { id: string; class_id: string; full_name: string; student_number: string | null }[] }),
  ])

  const submissions   = (submissionsRes.data ?? []) as AnalitikSubmission[]
  const students      = (studentsRes.data  ?? []) as AnalitikStudent[]
  const activeClasses = (classesRes.data   ?? []).filter(c => classIds.includes(c.id))

  const teacherProfilesRes = isManager
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', sid)
        .in('role', ['ogretmen', 'zumre_baskani'])
    : { data: [] as { id: string; full_name: string }[] }

  const teacherStats: TeacherStat[] = isManager
    ? computeTeacherStats(teacherProfilesRes.data ?? [], homeworks, submissions, students)
    : []

  const riskyStudents = computeRiskyStudents(students, homeworks, submissions)
  const kpi           = computeKpiCards(homeworks, submissions, students, riskyStudents.length)
  const weeklyTrend   = computeWeeklyTrend(homeworks, submissions, students)
  const heatmap       = computeClassWeekHeatmap(homeworks, submissions, students, activeClasses)

  const classStats = activeClasses.map(c => {
    const studentCount = students.filter(s => s.class_id === c.id).length
    return { name: c.name, grade: c.grade, ...computeClassStats(c.id, homeworks, submissions, studentCount) }
  }).filter(c => c.totalHomeworks > 0)

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-purple-50/10 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ödev Analitiği</h1>
          <Link
            href="/odevler"
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
          >
            ← Ödevler
          </Link>
        </div>
        <AnalitikOzet kpi={kpi} />
        <BasariHeatmap data={heatmap} />
        <SinifDetay classStats={classStats} weeklyTrend={weeklyTrend} />
        <OgrenciSicil riskyStudents={riskyStudents} />
        {isManager && <OgretmenKarsilastirma stats={teacherStats} />}
      </div>
    </div>
  )
}
