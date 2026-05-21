import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'

export const revalidate = 0
import Link from 'next/link'
import StatusBoard from './StatusBoard'
import PrintButton from '@/components/PrintButton'
import { format, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'

export default async function OdevDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const supabase = await createClient()

  const { data: hw } = await supabase
    .from('homeworks')
    .select('*, classes(name)')
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .single()

  if (!hw) notFound()

  const [studentsResult, subsResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', hw.class_id)
      .eq('school_id', profile.school_id),
    supabase.from('homework_submissions').select('student_id, status, note').eq('homework_id', id),
  ])

  const students = studentsResult.data ?? []
  const subs = subsResult.data ?? []
  const subMap = new Map(subs.map((s) => [s.student_id, s]))

  const items = students
    .map((student) => {
      const sub = subMap.get(student.id)
      return {
        student_id: student.id,
        full_name: student.full_name,
        student_number: student.student_number,
        status: (sub?.status ?? 'yapilmadi') as SubmissionStatus,
        note: sub?.note ?? null,
      }
    })
    .sort((a, b) =>
      (a.student_number ?? '').localeCompare(b.student_number ?? '', 'tr', { numeric: true })
    )

  const cls = hw.classes as { name: string } | null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3 print:hidden">
        <Link href="/odevler" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
          ← Ödevler
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{hw.title}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {cls?.name ?? '—'} · {hw.subject} · Son:{' '}
          {format(parseISO(hw.due_date), 'd MMMM yyyy')}
        </p>
        {hw.description && (
          <p className="text-sm text-gray-700 dark:text-slate-300 mt-3 bg-gray-50 dark:bg-slate-800 rounded-xl p-3 border border-gray-200 dark:border-slate-700">
            {hw.description}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">
          Bu sınıfta henüz öğrenci yok.
        </p>
      ) : (
        <StatusBoard homeworkId={id} items={items} homeworkTitle={hw.title} />
      )}
    </div>
  )
}
