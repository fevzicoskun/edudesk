import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PrintButton from './PrintButton'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

type SubmissionStatus = 'yapildi' | 'eksik' | 'yapilmadi' | 'gec' | 'mazeretli'

const LABELS: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı',
  eksik: 'Eksik',
  yapilmadi: 'Yapılmadı',
  gec: 'Geç Teslim',
  mazeretli: 'Mazeretli',
}

const BADGE_COLOR: Record<SubmissionStatus, string> = {
  yapildi: 'bg-green-100 text-green-700 border-green-200',
  eksik: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200',
  gec: 'bg-orange-100 text-orange-700 border-orange-200',
  mazeretli: 'bg-slate-100 text-slate-600 border-slate-200',
}

const DOT_COLOR: Record<SubmissionStatus, string> = {
  yapildi: 'bg-green-500',
  eksik: 'bg-yellow-400',
  yapilmadi: 'bg-red-500',
  gec: 'bg-orange-400',
  mazeretli: 'bg-slate-400',
}

type HomeworkRel = { title: string; subject: string; due_date: string; description: string | null } | null
type SubmissionRow = { id: string; status: SubmissionStatus; updated_at: string; homeworks: HomeworkRel }
type NoteRow = { id: string; body: string; created_at: string }

export default async function VeliPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const supabase = await createClient()

  const [studentResult, submissionsResult, notesResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, student_number, classes(name, grade)')
      .eq('id', studentId)
      .single(),
    supabase
      .from('homework_submissions')
      .select('id, status, updated_at, homeworks(title, subject, due_date, description)')
      .eq('student_id', studentId),
    supabase
      .from('student_notes')
      .select('id, body, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
  ])

  if (!studentResult.data) notFound()

  const student = studentResult.data
  const cls = student.classes as unknown as { name: string; grade: number } | null
  const submissions = ((submissionsResult.data ?? []) as unknown as SubmissionRow[]).sort((a, b) =>
    (b.homeworks?.due_date ?? '').localeCompare(a.homeworks?.due_date ?? '')
  )
  const notes = (notesResult.data ?? []) as NoteRow[]

  const total = submissions.length
  const done = submissions.filter(s => s.status === 'yapildi').length
  const missing = submissions.filter(s => s.status === 'yapilmadi' || s.status === 'eksik').length
  const rate = total > 0 ? Math.round((done / total) * 100) : 0

  const today = new Date().toISOString().split('T')[0]
  const upcoming = submissions.filter(s => (s.homeworks?.due_date ?? '') >= today)
  const past = submissions.filter(s => (s.homeworks?.due_date ?? '') < today)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">EduDesk · Veli Görünümü</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{student.full_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700">{cls?.name ?? '—'}</p>
              {student.student_number && (
                <p className="text-xs text-gray-400 mt-0.5">No: {student.student_number}</p>
              )}
            </div>
            <PrintButton />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Özet kartlar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-500 mt-1">Toplam Ödev</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{done}</p>
            <p className="text-xs text-green-600 mt-1">Tamamlandı</p>
          </div>
          <div className={`border rounded-2xl p-4 text-center ${missing > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-3xl font-bold ${missing > 0 ? 'text-red-600' : 'text-gray-400'}`}>{missing}</p>
            <p className={`text-xs mt-1 ${missing > 0 ? 'text-red-500' : 'text-gray-400'}`}>Eksik/Yapılmadı</p>
          </div>
        </div>

        {/* Tamamlanma oranı */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Ödev Tamamlanma Oranı</p>
            <p className="text-sm font-bold text-gray-900">{rate}%</p>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`}
              style={{ width: `${rate}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {done} ödev tamamlandı · {total - done} ödev bekliyor veya eksik
          </p>
        </div>

        {/* Yaklaşan ödevler */}
        {upcoming.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Güncel ve Yaklaşan Ödevler</h2>
            <div className="space-y-2.5">
              {upcoming.map(s => {
                const hw = s.homeworks
                const isOverdue = (hw?.due_date ?? '') < today
                return (
                  <div key={s.id} className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${DOT_COLOR[s.status]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{hw?.title ?? 'Ödev'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {hw?.subject ?? '—'} ·{' '}
                        <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                          {hw?.due_date ? format(parseISO(hw.due_date), 'd MMMM yyyy', { locale: tr }) : '—'}
                          {isOverdue ? ' (Geçti)' : ''}
                        </span>
                      </p>
                    </div>
                    <span className={`border rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${BADGE_COLOR[s.status]}`}>
                      {LABELS[s.status]}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Geçmiş ödevler */}
        {past.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Geçmiş Ödevler</h2>
            <div className="space-y-2">
              {past.map(s => {
                const hw = s.homeworks
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{hw?.title ?? 'Ödev'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {hw?.subject ?? '—'} · {hw?.due_date ? format(parseISO(hw.due_date), 'd MMM yyyy', { locale: tr }) : '—'}
                      </p>
                    </div>
                    <span className={`border rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${BADGE_COLOR[s.status]}`}>
                      {LABELS[s.status]}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Öğretmen notları */}
        {notes.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Öğretmen Notları</h2>
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-2">{format(parseISO(n.created_at), 'd MMM yyyy', { locale: tr })}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 py-4">
          Bu sayfa yalnızca bilgi amaçlıdır · EduDesk
        </p>
      </main>
    </div>
  )
}
