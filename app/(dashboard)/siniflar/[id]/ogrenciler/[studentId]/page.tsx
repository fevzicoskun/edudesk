import { createClient } from '@/src/infrastructure/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'
import { addStudentNote, deleteStudentNote } from '@/src/domains/classes/actions'
import VeliIletisimForm from './VeliIletisimForm'
import CopyVeliLink from './CopyVeliLink'
import ParentContactLogSection from './ParentContactLogSection'
import VeliAnalyticsCard from './VeliAnalyticsCard'
import SetupBanner from '@/components/SetupBanner'
import type { SubmissionStatus } from '@/src/shared/types'
import OdevGecmisiSection from './OdevGecmisiSection'
import NotGecmisiSection from './NotGecmisiSection'
import DevamsizlikPaneli from './DevamsizlikPaneli'
import { schoolYearStart } from '@/src/shared/utils'
import { getCurrentProfile } from '@/src/shared/auth'
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'

export const revalidate = 60

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

type HomeworkRel = { id: string; title: string; subject: string; due_date: string } | null
type SubmissionRow = { id: string; status: SubmissionStatus; updated_at: string; homeworks: HomeworkRel }
type NoteRow = { id: string; body: string; created_at: string }

export default async function OgrenciDetayPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>
}) {
  const { id: classId, studentId } = await params
  const supabase = await createClient()

  const currentProfile = await getCurrentProfile()
  if (!currentProfile?.school_id) redirect('/login')

  const schoolId = currentProfile.school_id

  const [classResult, studentResult, submissionsResult, notesResult, attendanceRes, gradesRes, contactLogsRes] = await Promise.all([
    supabase.from('classes').select('id, name').eq('id', classId).eq('school_id', schoolId).single(),
    supabase.from('students').select('id, full_name, student_number, class_id, veli_email, veli_telefon, veli_ad').eq('id', studentId).eq('class_id', classId).eq('school_id', schoolId).single(),
    supabase.from('homework_submissions').select('id, status, updated_at, homeworks(id, title, subject, due_date)').eq('student_id', studentId).eq('school_id', schoolId),
    supabase.from('student_notes').select('id, body, created_at').eq('student_id', studentId).eq('school_id', schoolId).order('created_at', { ascending: false }),
    supabase.from('attendance').select('date, status').eq('student_id', studentId).eq('school_id', schoolId).in('status', ['absent', 'late', 'excused']).gte('date', schoolYearStart()).order('date', { ascending: false }),
    supabase.from('grade_entries').select('score, grade_columns!inner(title, grade_type, max_score, exam_date, class_id)').eq('student_id', studentId).eq('school_id', schoolId).eq('grade_columns.class_id', classId),
    supabase
      .from('parent_contact_logs')
      .select('id, note, contact_method, contacted_at, teacher_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('contacted_at', { ascending: false })
      .limit(50),
  ])

  if (!classResult.data || !studentResult.data) notFound()

  const cls = classResult.data
  const student = studentResult.data
  const submissions = ((submissionsResult.data ?? []) as SubmissionRow[]).sort((a, b) =>
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
  const absentPct = Math.min((absentDays / ATTENDANCE_LIMIT_DAYS) * 100, 100)
  const absenceDanger = absentDays >= ATTENDANCE_LIMIT_DAYS
  const absenceWarn   = absentDays >= ATTENDANCE_WARN_DAYS && !absenceDanger

  // Performans skoru
  const totalSubmissions = submissions.length
  const completedCount   = (statusCounts['yapildi'] ?? 0) + (statusCounts['gec'] ?? 0) * 0.5
  const completionRate   = totalSubmissions > 0 ? completedCount / totalSubmissions : 1
  const isRisk   = absenceDanger || completionRate < 0.4
  const isWarn   = !isRisk && (absenceWarn || completionRate < 0.6)
  const riskLabel = isRisk ? 'Risk' : isWarn ? 'Dikkat' : 'İyi'
  const riskColor = isRisk
    ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
    : isWarn
      ? 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
      : 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'

  // Not defteri
  type GradeRow = { score: number | null; grade_columns: { title: string; grade_type: string; max_score: number; exam_date: string | null; class_id: string } }
  const grades = (gradesRes.data ?? []) as GradeRow[]

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
        <CopyVeliLink
          studentId={studentId}
          studentName={student.full_name}
          veliAd={student.veli_ad ?? null}
        />
      </div>

      {/* Performans özeti */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Performans Özeti</h2>
        <div className="grid grid-cols-3 gap-4">
          {/* Risk skoru */}
          <div className="flex flex-col items-center justify-center text-center">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border mb-1 ${riskColor}`}>{riskLabel}</span>
            <p className="text-[11px] text-gray-400 dark:text-slate-500">Genel Durum</p>
          </div>
          {/* Ödev tamamlanma */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-gray-500 dark:text-slate-400">Ödev Tamamlanma</p>
              <p className="text-xs font-bold text-gray-700 dark:text-slate-200">{Math.round(completionRate * 100)}%</p>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${completionRate >= 0.8 ? 'bg-green-400' : completionRate >= 0.6 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${Math.round(completionRate * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">{totalSubmissions} ödev kaydı</p>
          </div>
          {/* Devamsızlık */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-gray-500 dark:text-slate-400">Devamsızlık</p>
              <p className={`text-xs font-bold ${absenceDanger ? 'text-red-500' : absenceWarn ? 'text-yellow-500' : 'text-gray-700 dark:text-slate-200'}`}>{absentDays} / {ATTENDANCE_LIMIT_DAYS}</p>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${absenceDanger ? 'bg-red-500' : absenceWarn ? 'bg-yellow-400' : 'bg-green-400'}`}
                style={{ width: `${absentPct}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">MEB sınırı {ATTENDANCE_LIMIT_DAYS} gün</p>
          </div>
        </div>
      </div>

      <VeliIletisimForm
        studentId={studentId}
        classId={classId}
        defaultEmail={student.veli_email ?? ''}
        defaultTelefon={student.veli_telefon ?? ''}
        defaultAd={student.veli_ad ?? ''}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {(['yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli'] as SubmissionStatus[]).map((status) => (
          <div key={status} className={`border rounded-xl p-3 ${BADGE[status]}`}>
            <p className="text-2xl font-bold">{statusCounts[status] ?? 0}</p>
            <p className="text-xs mt-0.5">{LABELS[status]}</p>
          </div>
        ))}
      </div>

      <DevamsizlikPaneli
        attendanceTableExists={attendanceTableExists}
        attendanceRecords={attendanceRecords}
        absentDays={absentDays}
        absentPct={absentPct}
        absenceDanger={absenceDanger}
        absenceWarn={absenceWarn}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OdevGecmisiSection submissions={submissions} />

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
                  className="w-full min-h-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400"
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
                        {format(parseISO(n.created_at), 'd MMM yyyy HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <NotGecmisiSection grades={grades} />

      <VeliAnalyticsCard studentId={studentId} schoolId={schoolId} />

      <ParentContactLogSection
        logs={(contactLogsRes.data ?? []) as Array<{ id: string; note: string; contact_method: string; contacted_at: string; teacher_id: string }>}
        studentId={studentId}
        classId={classId}
        currentUserId={currentProfile.id}
      />

    </div>
  )
}
