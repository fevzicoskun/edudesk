import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PrintButton from './PrintButton'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { verifyPublicToken, isTokenRevoked, looksLikeToken } from '@/lib/public-tokens'
import { UUID } from '@/lib/validation'

function schoolYearStart(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-09-01`
}

const MEB_LIMIT = 20

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

function TokenExpiredPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Link Geçersiz veya Süresi Dolmuş</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Bu veli portalı linkinin süresi dolmuş ya da geçersiz. Güncel bir link için lütfen öğretmeninizle iletişime geçin.
        </p>
      </div>
    </div>
  )
}

export default async function VeliPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let studentId: string

  if (looksLikeToken(token)) {
    const supabase = await createClient()
    const result = await verifyPublicToken(token, 'veli')
    if (!result.ok) return <TokenExpiredPage />
    if (result.payload.jti && await isTokenRevoked(result.payload.jti, supabase)) {
      return <TokenExpiredPage />
    }
    studentId = result.payload.id
  } else if (UUID.safeParse(token).success) {
    // Eski UUID tabanlı link — geçersiz sayıyoruz (yeni link almaları gerekiyor)
    return <TokenExpiredPage />
  } else {
    notFound()
  }

  const supabase = await createClient()
  const [studentResult, submissionsResult, notesResult, attendanceRes] = await Promise.all([
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
    supabase
      .from('attendance')
      .select('date, status')
      .eq('student_id', studentId)
      .gte('date', schoolYearStart())
      .order('date', { ascending: false }),
  ])

  if (!studentResult.data) notFound()

  const student = studentResult.data
  const cls = student.classes as unknown as { name: string; grade: number } | null
  const submissions = ((submissionsResult.data ?? []) as unknown as SubmissionRow[]).sort((a, b) =>
    (b.homeworks?.due_date ?? '').localeCompare(a.homeworks?.due_date ?? '')
  )
  const notes = (notesResult.data ?? []) as NoteRow[]

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

  const total = submissions.length
  const done = submissions.filter(s => s.status === 'yapildi').length
  const missing = submissions.filter(s => s.status === 'yapilmadi' || s.status === 'eksik').length
  const rate = total > 0 ? Math.round((done / total) * 100) : 0

  const today = new Date().toISOString().split('T')[0]
  const upcoming = submissions.filter(s => (s.homeworks?.due_date ?? '') >= today)
  const past = submissions.filter(s => (s.homeworks?.due_date ?? '') < today)

  return (
    <div className="min-h-screen bg-gray-50">
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
          <p className="text-xs text-gray-400 mt-2">{done} ödev tamamlandı · {total - done} ödev bekliyor veya eksik</p>
        </div>

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

        {attendanceTableExists && (
          <section className="bg-white border border-gray-200 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Yıl İçi Devamsızlık</h2>
            <p className="text-xs text-gray-400 mb-3">MEB sınırı: {MEB_LIMIT} gün · Geç giriş = 0,5 gün</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${absenceDanger ? 'bg-red-500' : absenceWarn ? 'bg-yellow-400' : 'bg-green-400'}`}
                  style={{ width: `${absentPct}%` }}
                />
              </div>
              <span className={`text-sm font-bold shrink-0 ${absenceDanger ? 'text-red-600' : absenceWarn ? 'text-yellow-600' : 'text-gray-700'}`}>
                {absentDays} / {MEB_LIMIT} gün
              </span>
            </div>
            {absenceDanger && <p className="text-xs text-red-600 font-medium mb-2">Devamsızlık sınırı aşıldı — lütfen okulla iletişime geçin.</p>}
            {absenceWarn && <p className="text-xs text-yellow-600 font-medium mb-2">Devamsızlık sınırına yaklaşılıyor.</p>}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: 'Yok', count: attendanceRecords.filter(r => r.status === 'absent').length, color: 'text-red-600' },
                { label: 'Geç', count: attendanceRecords.filter(r => r.status === 'late').length, color: 'text-yellow-600' },
                { label: 'Mazeretli', count: attendanceRecords.filter(r => r.status === 'excused').length, color: 'text-blue-600' },
              ].map(({ label, count, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{count}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {attendanceRecords.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Son Kayıtlar</p>
                <div className="space-y-1.5">
                  {attendanceRecords.slice(0, 10).map((r, i) => {
                    const statusLabel: Record<string, string> = { present: 'Var', absent: 'Yok', late: 'Geç', excused: 'Mazeretli' }
                    const statusColor: Record<string, string> = {
                      present: 'bg-green-100 text-green-700',
                      absent: 'bg-red-100 text-red-700',
                      late: 'bg-yellow-100 text-yellow-700',
                      excused: 'bg-blue-100 text-blue-700',
                    }
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{format(parseISO(r.date), 'd MMMM yyyy', { locale: tr })}</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] ?? ''}`}>
                          {statusLabel[r.status] ?? r.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        <p className="text-center text-xs text-gray-400 py-4">Bu sayfa yalnızca bilgi amaçlıdır · EduDesk</p>
      </main>
    </div>
  )
}
