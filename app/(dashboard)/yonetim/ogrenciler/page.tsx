import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import OgrencilerClient from './OgrencilerClient'

export const revalidate = 60

export default async function OgrencilerPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'mudur') redirect('/anasayfa')

  const supabase = await createClient()

  const { data } = await supabase
    .from('classes')
    .select('id, name, grade, students(id, full_name, student_number)')
    .eq('school_id', profile.school_id!)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  const classes = (data ?? []).map(cls => ({
    ...cls,
    students: ((cls.students ?? []) as { id: string; full_name: string; student_number: string | null; deleted_at?: string | null }[])
      .filter(s => !s.deleted_at)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr')),
  }))

  const totalStudents = classes.reduce((acc, c) => acc + c.students.length, 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/yonetim"
          className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Öğrenciler</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {totalStudents} öğrenci · {classes.length} sınıf
          </p>
        </div>
      </div>

      <OgrencilerClient classes={classes} />
    </div>
  )
}
