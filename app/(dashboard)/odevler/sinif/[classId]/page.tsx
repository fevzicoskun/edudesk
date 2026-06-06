import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import Link from 'next/link'
import PrintButton from '@/components/PrintButton'
import MatrisClient from './MatrisClient'

type SubmissionStatus = 'yapildi' | 'eksik' | 'yapilmadi' | 'gec' | 'mazeretli'

export default async function SinifMatrisPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const canSee = isTeachingRole(profile.role) || isMudurOrAbove(profile.role)
  if (!canSee) redirect('/odevler')

  const supabase = await createClient()
  const sid = profile.school_id

  const [clsRes, studentsRes, homeworksRes] = await Promise.all([
    supabase.from('classes').select('name, grade').eq('id', classId).eq('school_id', sid).single(),
    supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', classId)
      .eq('school_id', sid)
      .is('deleted_at', null)
      .order('student_number'),
    supabase
      .from('homeworks')
      .select('id, title, subject, due_date')
      .eq('class_id', classId)
      .eq('school_id', sid)
      .is('deleted_at', null)
      .eq('is_template', false)
      .order('due_date', { ascending: false })
      .limit(30),
  ])

  if (!clsRes.data) notFound()

  const students  = studentsRes.data  ?? []
  const homeworks = homeworksRes.data ?? []

  const hwIds = homeworks.map(h => h.id)
  const { data: rawSubs } = hwIds.length > 0
    ? await supabase
        .from('homework_submissions')
        .select('homework_id, student_id, status')
        .in('homework_id', hwIds)
        .eq('school_id', sid)
    : { data: [] as { homework_id: string; student_id: string; status: string }[] }

  const subMap: Record<string, SubmissionStatus> = {}
  for (const s of rawSubs ?? []) {
    subMap[`${s.student_id}_${s.homework_id}`] = s.status as SubmissionStatus
  }

  const cls = clsRes.data

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-indigo-50/10 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 md:p-6">

        <div className="flex items-center justify-between mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/odevler"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {cls.name} — Ödev Matrisi
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {students.length} öğrenci · Son {homeworks.length} ödev
              </p>
            </div>
          </div>
          <PrintButton />
        </div>

        {homeworks.length === 0 || students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-500 dark:text-slate-400 font-medium">
              {homeworks.length === 0 ? 'Bu sınıfa henüz ödev atanmamış.' : 'Bu sınıfta henüz öğrenci yok.'}
            </p>
            <Link href="/odevler" className="mt-4 text-sm text-blue-600 hover:underline">← Ödevlere dön</Link>
          </div>
        ) : (
          <MatrisClient
            students={students}
            homeworks={homeworks}
            subMap={subMap}
            className={cls.name}
          />
        )}
      </div>
    </div>
  )
}
