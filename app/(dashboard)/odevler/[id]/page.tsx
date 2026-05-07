import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StatusBoard from './StatusBoard'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

export default async function OdevDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [hwResult, subsResult] = await Promise.all([
    supabase.from('homeworks').select('*, classes(name)').eq('id', id).single(),
    supabase
      .from('homework_submissions')
      .select('id, homework_id, student_id, status, note, students(full_name, student_number)')
      .eq('homework_id', id),
  ])

  if (!hwResult.data) notFound()
  const hw = hwResult.data
  const cls = hw.classes as { name: string } | null
  const submissions = subsResult.data ?? []

  const sorted = [...submissions].sort((a, b) => {
    const sa = a.students as unknown as { student_number: string | null } | null
    const sb = b.students as unknown as { student_number: string | null } | null
    const na = sa?.student_number ?? ''
    const nb = sb?.student_number ?? ''
    return na.localeCompare(nb, 'tr', { numeric: true })
  })

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

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <StatusBoard homeworkId={id} submissions={sorted as any} />
    </div>
  )
}
