export const revalidate = 30

import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
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

  // Yıl içi devamsızlık sayaçları
  const studentIds = classes.flatMap(c => c.students.map(s => s.id))
  const absenceCounts: Record<string, number> = {}

  if (studentIds.length > 0) {
    const { data: absences } = await supabase
      .from('attendance')
      .select('student_id, status, date')
      .eq('school_id', profile.school_id)
      .in('student_id', studentIds)
      .gte('date', schoolYearStart())
      .in('status', ['absent', 'late'])

    for (const a of absences ?? []) {
      const [y, m, d] = (a.date as string).split('-').map(Number)
      const dow = new Date(y, m - 1, d).getDay()
      if (dow === 0 || dow === 6) continue  // hafta sonu kayıtları sayılmaz
      const increment = a.status === 'absent' ? 1 : 0.5
      absenceCounts[a.student_id] = (absenceCounts[a.student_id] ?? 0) + increment
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{getEgitimYili()} — Devamsız öğrencilerin velisine otomatik e-posta gider</p>
      </div>
      <YoklamaClient classes={classes} absenceCounts={absenceCounts} />
    </div>
  )
}

interface Student          { id: string; full_name: string; student_number: string | null }
export interface ClassWithStudents { id: string; name: string; grade: number; students: Student[] }
