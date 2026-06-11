export const revalidate = 30

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
import { type AttendanceStatus } from '@/app/actions/yoklama'
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import type { AbsenceCount } from '@/src/domains/attendance/types'
import YoklamaClient from './YoklamaClient'

export default async function YoklamaPage({ searchParams }: { searchParams: Promise<{ sinif?: string }> }) {
  const { sinif } = await searchParams
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  const { data: rawClasses } = await supabase
    .from('classes')
    .select('id, name, grade, mentor_teacher_id, students(id, full_name, student_number, deleted_at)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  const classes: ClassWithStudents[] = (rawClasses ?? []).map(cls => ({
    id: cls.id,
    name: cls.name,
    grade: cls.grade,
    mentor_teacher_id: cls.mentor_teacher_id,
    students: ((cls.students ?? []) as (Student & { deleted_at: string | null })[])
      .filter(s => !s.deleted_at)
      .map(({ deleted_at: _omit, ...s }) => s),
  }))

  const { data: tcRows } = await supabase
    .from('teacher_classes')
    .select('class_id')
    .eq('teacher_id', profile.id)

  const myClassIds = new Set<string>([
    ...classes.filter(c => c.mentor_teacher_id === profile.id).map(c => c.id),
    ...(tcRows ?? []).map(r => r.class_id),
  ])

  const canEditAfterLock = ['mudur_yardimcisi', 'mudur', 'admin'].includes(profile.role)

  const validSinif   = sinif && classes.some(c => c.id === sinif) ? sinif : null
  const firstMyClass = classes.find(c => myClassIds.has(c.id))?.id ?? null
  const firstClassId = validSinif ?? firstMyClass ?? classes[0]?.id ?? ''

  const studentIds = classes.flatMap(c => c.students.map(s => s.id))
  const todayISO   = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

  const [absencesRes, todayRes] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from('attendance')
          .select('student_id, status, date')
          .eq('school_id', profile.school_id)
          .in('student_id', studentIds)
          .gte('date', schoolYearStart())
          .in('status', ['absent', 'late', 'excused'])
          .limit(100000)
      : Promise.resolve({ data: [] as { student_id: string; status: string; date: string }[] }),
    firstClassId
      ? supabase
          .from('attendance')
          .select('student_id, status')
          .eq('class_id', firstClassId)
          .eq('school_id', profile.school_id)
          .eq('date', todayISO)
      : Promise.resolve({ data: [] as { student_id: string; status: string }[] }),
  ])

  const absenceCounts: Record<string, AbsenceCount> = countAbsences(absencesRes.data ?? [])

  const initialStatuses: Record<string, AttendanceStatus> = {}
  for (const row of todayRes.data ?? []) {
    initialStatuses[row.student_id] = row.status as AttendanceStatus
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{getEgitimYili()} — Devamsız ve geç öğrencilerin velisine otomatik e-posta gider (özürlüye gitmez)</p>
        </div>
        <Link
          href="/yoklama/cizelge"
          className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          Çizelge →
        </Link>
      </div>
      <YoklamaClient
        classes={classes}
        absenceCounts={absenceCounts}
        initialStatuses={initialStatuses}
        initialDate={todayISO}
        myClassIds={[...myClassIds]}
        initialClassId={firstClassId}
        canEditAfterLock={canEditAfterLock}
      />
    </div>
  )
}

interface Student          { id: string; full_name: string; student_number: string | null }
export interface ClassWithStudents {
  id: string
  name: string
  grade: number
  mentor_teacher_id: string | null
  students: Student[]
}
