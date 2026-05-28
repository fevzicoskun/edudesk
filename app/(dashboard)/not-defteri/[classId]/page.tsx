import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import GradeGrid from './GradeGrid'
import type { GradeColumn, GradeEntry } from '@/src/domains/grades/types'

export const revalidate = 3600

export default async function NotDefteriDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile?.school_id) return null

  const supabase = await createClient()
  const schoolId = profile.school_id
  const isManager = isMudurOrAbove(profile.role)

  const [classResult, studentsResult, columnsResult] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade, mentor_teacher_id')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .single(),
    supabase
      .from('students')
      .select('id, full_name')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('full_name'),
    supabase
      .from('grade_columns')
      .select('*')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .order('exam_date', { nullsFirst: false })
      .order('created_at'),
  ])

  if (!classResult.data) notFound()

  const cls = classResult.data

  const columns = (columnsResult.data ?? []) as GradeColumn[]
  const students = studentsResult.data ?? []

  // Sütunların entry'lerini çek
  const columnIds = columns.map(c => c.id)
  const entriesResult = columnIds.length
    ? await supabase
        .from('grade_entries')
        .select('*')
        .in('grade_column_id', columnIds)
        .eq('school_id', schoolId)
    : { data: [] }
  const entries = (entriesResult.data ?? []) as GradeEntry[]

  const canWrite = !isManager // yöneticiler salt okunur, öğretmenler yazabilir

  return (
    <div className="p-6 max-w-full">
      <Link
        href="/not-defteri"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft size={16} />
        Not Defteri
      </Link>

      <h1 className="text-2xl font-bold mb-1">
        {cls.name} <span className="text-muted-foreground font-normal text-lg">— {cls.grade}. Sınıf</span>
      </h1>
      <p className="text-sm text-muted-foreground mb-6">{students.length} öğrenci</p>

      <GradeGrid
        classId={classId}
        columns={columns}
        entries={entries}
        students={students}
        canWrite={canWrite}
      />
    </div>
  )
}
