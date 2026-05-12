import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const revalidate = 60
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { addStudentNote } from '@/app/actions/class'
import CopyVeliLink from './CopyVeliLink'
import type { SubmissionStatus } from '@/lib/types'

const LABELS: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı',
  eksik: 'Eksik',
  yapilmadi: 'Yapılmadı',
  gec: 'Geç',
  mazeretli: 'Mazeretli',
}

const BADGE: Record<SubmissionStatus, string> = {
  yapildi: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  eksik: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  gec: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  mazeretli: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
}

type HomeworkRel = { title: string; subject: string; due_date: string } | null
type SubmissionRow = { id: string; status: SubmissionStatus; updated_at: string; homeworks: HomeworkRel }
type NoteRow = { id: string; body: string; created_at: string }

export default async function OgrenciDetayPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>
}) {
  const { id: classId, studentId } = await params
  const supabase = await createClient()

  const [classResult, studentResult, submissionsResult, notesResult] = await Promise.all([
    supabase.from('classes').select('id, name').eq('id', classId).single(),
    supabase.from('students').select('id, full_name, student_number, class_id').eq('id', studentId).eq('class_id', classId).single(),
    supabase.from('homework_submissions').select('id, status, updated_at, homeworks(title, subject, due_date)').eq('student_id', studentId),
    supabase.from('student_notes').select('id, body, created_at').eq('student_id', studentId).order('created_at', { ascending: false }),
  ])

  if (!classResult.data || !studentResult.data) notFound()

  const cls = classResult.data
  const student = studentResult.data
  const submissions = ((submissionsResult.data ?? []) as unknown as SubmissionRow[]).sort((a, b) =>
    (b.homeworks?.due_date ?? '').localeCompare(a.homeworks?.due_date ?? '')
  )
  const notes = (notesResult.data ?? []) as NoteRow[]

  const statusCounts = submissions.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {} as Record<SubmissionStatus, number>)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link href={`/siniflar/${classId}`} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 mb-3 inline-block">
        ← {cls.name}
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{student.full_name}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {cls.name} {student.student_number ? `· No: ${student.student_number}` : ''}
          </p>
        </div>
        <CopyVeliLink studentId={studentId} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {(['yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli'] as SubmissionStatus[]).map((status) => (
          <div key={status} className={`border rounded-xl p-3 ${BADGE[status]}`}>
            <p className="text-2xl font-bold">{statusCounts[status] ?? 0}</p>
            <p className="text-xs mt-0.5">{LABELS[status]}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Ödev Geçmişi</h2>
          {submissions.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-10">Henüz ödev kaydı yok.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => (
                <div key={s.id} className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{s.homeworks?.title ?? 'Ödev'}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {s.homeworks?.subject ?? '—'} ·{' '}
                      {s.homeworks?.due_date ? format(parseISO(s.homeworks.due_date), 'd MMM yyyy', { locale: tr }) : 'Tarih yok'}
                    </p>
                  </div>
                  <span className={`border rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${BADGE[s.status]}`}>
                    {LABELS[s.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Öğretmen Notları</h2>
          <form action={addStudentNote.bind(null, studentId, classId)} className="mb-4">
            <textarea
              name="body"
              required
              placeholder="Kısa not yaz..."
              className="w-full min-h-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400"
            />
            <button type="submit" className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Not Ekle
            </button>
          </form>

          {notes.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Henüz not yok.</p>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2">
                  <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                    {format(parseISO(n.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
