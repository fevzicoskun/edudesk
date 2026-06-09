export const revalidate = 30

import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
import { type AttendanceStatus } from '@/app/actions/yoklama'
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import type { AbsenceCount } from '@/src/domains/attendance/types'
import YoklamaClient from './YoklamaClient'

export default async function YoklamaPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  const { data: rawClasses } = await supabase
    .from('classes')
    .select('id, name, grade, students(id, full_name, student_number, deleted_at)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  const classes: ClassWithStudents[] = (rawClasses ?? []).map(cls => ({
    ...cls,
    students: ((cls.students ?? []) as (Student & { deleted_at: string | null })[])
      .filter(s => !s.deleted_at),
  }))

  const studentIds   = classes.flatMap(c => c.students.map(s => s.id))
  const firstClassId = classes[0]?.id ?? ''
  const todayISO     = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

  // Yıllık devamsızlıklar + bugünün yoklaması paralel
  const [absencesRes, todayRes] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from('attendance')
          .select('student_id, status, date')
          .eq('school_id', profile.school_id)
          .in('student_id', studentIds)
          .gte('date', schoolYearStart())
          .in('status', ['absent', 'late', 'excused'])
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
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{getEgitimYili()} — Devamsız ve geç öğrencilerin velisine otomatik e-posta gider (özürlüye gitmez)</p>
      </div>
      <YoklamaClient
        classes={classes}
        absenceCounts={absenceCounts}
        initialStatuses={initialStatuses}
        initialDate={todayISO}
      />
    </div>
  )
}

interface Student          { id: string; full_name: string; student_number: string | null }
export interface ClassWithStudents { id: string; name: string; grade: number; students: Student[] }
