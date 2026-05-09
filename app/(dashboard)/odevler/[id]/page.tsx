import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StatusBoard from './StatusBoard'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { SubmissionStatus } from '@/lib/types'

export default async function OdevDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: hw } = await supabase
    .from('homeworks')
    .select('*, classes(name)')
    .eq('id', id)
    .single()

  if (!hw) notFound()

  const [studentsResult, subsResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', hw.class_id),
    supabase.from('homework_submissions').select('student_id, status').eq('homework_id', id),
  ])

  const students = studentsResult.data ?? []
  const subs = subsResult.data ?? []
  const subMap = new Map(subs.map((s) => [s.student_id, s.status as SubmissionStatus]))

  const items = students
    .map((student) => ({
      student_id: student.id,
      full_name: student.full_name,
      student_number: student.student_number,
      status: (subMap.get(student.id) ?? 'yapilmadi') as SubmissionStatus,
    }))
    .sort((a, b) =>
      (a.student_number ?? '').localeCompare(b.student_number ?? '', 'tr', { numeric: true })
    )

  const cls = hw.classes as { name: string } | null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href="/odevler" className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-block">
        ← Ödevler
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{hw.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {cls?.name ?? '—'} · {hw.subject} · Son:{' '}
          {format(parseISO(hw.due_date), 'd MMMM yyyy', { locale: tr })}
        </p>
        {hw.description && (
          <p className="text-sm text-gray-700 mt-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
            {hw.description}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">
          Bu sınıfta henüz öğrenci yok.
        </p>
      ) : (
        <StatusBoard homeworkId={id} items={items} />
      )}
    </div>
  )
}
