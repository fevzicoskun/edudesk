import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const revalidate = 60
import Link from 'next/link'

function schoolYearStart(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-09-01`
}

const MEB_LIMIT = 20
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { addStudentNote, deleteStudentNote } from '@/app/actions/class'
import CopyVeliLink from './CopyVeliLink'
import SetupBanner from '@/components/SetupBanner'
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

  const [classResult, studentResult, submissionsResult, notesResult, attendanceRes] = await Promise.all([
    supabase.from('classes').select('id, name').eq('id', classId).single(),
    supabase.from('students').select('id, full_name, student_number, class_id').eq('id', studentId).eq('class_id', classId).single(),
    supabase.from('homework_submissions').select('id, status, updated_at, homeworks(title, subject, due_date)').eq('student_id', studentId),
    supabase.from('student_notes').select('id, body, created_at').eq('student_id', studentId).order('created_at', { ascending: false }),
    supabase.from('attendance').select('date, status').eq('student_id', studentId).gte('date', schoolYearStart()).order('date', { ascending: false }),
  ])

  if (!classResult.data || !studentResult.data) notFound()

  const cls = classResult.data
  const student = studentResult.data
  const submissions = ((submissionsResult.data ?? []) as unknown as SubmissionRow[]).sort((a, b) =>
    (b.homeworks?.due_date ?? '').localeCompare(a.homeworks?.due_date ?? '')
  )
  const studentNotesTableExists = notesResult.error?.code !== '42P01'
  const notes = (notesResult.data ?? []) as NoteRow[]

  const statusCounts = submissions.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {} as Record<SubmissionStatus, number>)

  const attendanceTableExists = attendanceRes.error?.code !== '42P01'
  const attendanceRecords = (attendanceRes.data ?? []) as { date: string; status: string }[]
  const absentDays = attendanceRecords.reduce((sum, r) => {
    if (r.status === 'absent') return sum + 1
    if (r.status === 'late') return sum + 0.5
    return sum
  }, 0)
  const absentPct = Math.min((absentDays / MEB_LIMIT) * 100, 100)
  const absenceDanger = absentDays >= MEB_LIMIT
  const absenceWarn = absentDays >= 15 && !absenceDanger

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link href={`/siniflar/${classId}`} prefetch={true} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 mb-3 inline-block">
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

      {/* Devamsızlık */}
      {attendanceTableExists && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Yıl İçi Devamsızlık</h2>
            <span className={`text-sm font-bold ${absenceDanger ? 'text-red-500' : absenceWarn ? 'text-yellow-500' : 'text-gray-500 dark:text-slate-400'}`}>
              {absentDays} / {MEB_LIMIT} gün
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${absenceDanger ? 'bg-red-500' : absenceWarn ? 'bg-yellow-400' : 'bg-green-400'}`}
              style={{ width: `${absentPct}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-gray-500 dark:text-slate-400">
            <span className="text-red-500 dark:text-red-400">{attendanceRecords.filter(r => r.status === 'absent').length} gün yok</span>
            <span className="text-yellow-500 dark:text-yellow-400">{attendanceRecords.filter(r => r.status === 'late').length} geç</span>
            <span className="text-blue-500 dark:text-blue-400">{attendanceRecords.filter(r => r.status === 'excused').length} mazeretli</span>
            {absenceDanger && <span className="text-red-600 dark:text-red-400 font-semibold ml-auto">Sınır aşıldı!</span>}
            {absenceWarn && <span className="text-yellow-600 dark:text-yellow-400 font-semibold ml-auto">Sınıra yakın</span>}
          </div>
          {attendanceRecords.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Son Kayıtlar</p>
              {attendanceRecords.slice(0, 8).map((r, i) => {
                const statusLabel: Record<string, string> = { present: 'Var', absent: 'Yok', late: 'Geç', excused: 'Mazeretli' }
                const statusColor: Record<string, string> = {
                  present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                  absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                  late: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
                  excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                }
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-slate-400">
                      {format(parseISO(r.date), 'd MMM yyyy', { locale: tr })}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] ?? ''}`}>
                      {statusLabel[r.status] ?? r.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
          {!studentNotesTableExists ? (
            <SetupBanner
              title="Kurulum gerekiyor — student_notes tablosu eksik"
              sql={`CREATE TABLE IF NOT EXISTS student_notes (\n  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,\n  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,\n  body       TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);\nCREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id, created_at DESC);\nALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "student_notes_read"   ON student_notes FOR SELECT TO authenticated USING (true);\nCREATE POLICY "student_notes_insert" ON student_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);\nCREATE POLICY "student_notes_delete" ON student_notes FOR DELETE TO authenticated USING (auth.uid() = teacher_id);`}
            />
          ) : (
            <>
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
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap flex-1">{n.body}</p>
                        <form action={deleteStudentNote.bind(null, n.id, studentId, classId)} className="shrink-0">
                          <button type="submit" className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Sil</button>
                        </form>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                        {format(parseISO(n.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
