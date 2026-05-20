import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MentorlukClient from './MentorlukClient'
import {
  addMentorStudent,
  deleteMentorStudent,
  addMentorStudentNote,
  deleteMentorStudentNote,
} from '@/app/actions/mentorluk'
import { addMentorReport, deleteMentorReport } from '@/app/actions/classes'

export const revalidate = 0

type SystemStudent = { id: string; full_name: string; student_number: string | null }
type SystemClass = { id: string; name: string; students: SystemStudent[] }
type MentorNote = { id: string; content: string; created_at: string }
type ManualStudent = {
  id: string
  full_name: string
  parent_name: string | null
  phone: string | null
  created_at: string
  mentor_student_notes: MentorNote[]
}
type MentorReport = { id: string; content: string; report_date: string; student_id: string }

export default async function MentorlukPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) redirect('/login')

  const supabase = await createClient()

  const [classesResult, manualResult, reportsResult] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, students(id, full_name, student_number)')
      .eq('mentor_teacher_id', user.id)
      .order('name'),
    supabase
      .from('mentor_students')
      .select('id, full_name, parent_name, phone, created_at, mentor_student_notes(id, content, created_at)')
      .eq('teacher_id', user.id)
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('mentor_reports')
      .select('id, content, report_date, student_id')
      .eq('mentor_id', user.id)
      .order('report_date', { ascending: false }),
  ])

  const systemClasses = (classesResult.data ?? []) as unknown as SystemClass[]
  const manualStudents = (manualResult.data ?? []) as unknown as ManualStudent[]
  const mentorReports = (reportsResult.data ?? []) as unknown as MentorReport[]

  const reportsByStudent = new Map<string, MentorReport[]>()
  for (const r of mentorReports) {
    const list = reportsByStudent.get(r.student_id) ?? []
    list.push(r)
    reportsByStudent.set(r.student_id, list)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Mentörlük</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Atanmış öğrenciler ve kendi eklediğin öğrenciler
        </p>
      </div>

      <MentorlukClient
        systemClasses={systemClasses}
        manualStudents={manualStudents}
        reportsByStudent={Object.fromEntries(reportsByStudent)}
        addMentorStudent={addMentorStudent}
        deleteMentorStudent={deleteMentorStudent}
        addMentorStudentNote={addMentorStudentNote}
        deleteMentorStudentNote={deleteMentorStudentNote}
        addMentorReport={addMentorReport}
        deleteMentorReport={deleteMentorReport}
      />
    </div>
  )
}
