import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { notFound } from 'next/navigation'
import PrintButton from '@/components/PrintButton'
import { format, parseISO } from '@/src/shared/date'
import { verifyPublicToken, isTokenRevoked, looksLikeToken } from '@/src/infrastructure/tokens'
import { UUID } from '@/src/shared/validation'
import VeliTracker from './VeliTracker'
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
type AttendanceRow = { date: string; status: 'absent' | 'late' }

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
  let tokenSchoolId: string | undefined
  let expiryText  = ''
  let expiryColor = ''

  if (looksLikeToken(token)) {
    const supabase = createServiceClient()
    const result = await verifyPublicToken(token, 'veli')
    if (!result.ok) return <TokenExpiredPage />
    if (result.payload.jti && await isTokenRevoked(result.payload.jti, supabase)) {
      return <TokenExpiredPage />
    }
    studentId     = result.payload.id
    tokenSchoolId = result.payload.m?.school_id
    const expiresAt = new Date(result.payload.exp * 1000)
    const daysLeft  = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
    expiryText  = daysLeft > 30
      ? `${expiresAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} kadar geçerli`
      : daysLeft > 1 ? `${daysLeft} gün kaldı` : 'Bugün geçecek'
    expiryColor = daysLeft > 30
      ? 'text-green-600 bg-green-50 border-green-200'
      : daysLeft > 7 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
      : 'text-orange-600 bg-orange-50 border-orange-200'
  } else if (UUID.safeParse(token).success) {
    // Eski UUID tabanlı link — geçersiz sayıyoruz (yeni link almaları gerekiyor)
    return <TokenExpiredPage />
  } else {
    notFound()
  }

  const supabase = createServiceClient()
  let studentQuery = supabase
    .from('students')
    .select('id, full_name, student_number, classes(name, grade)')
    .eq('id', studentId)
  if (tokenSchoolId) studentQuery = studentQuery.eq('school_id', tokenSchoolId)

  const schoolFilter = tokenSchoolId
  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0]
  const [studentResult, submissionsResult, notesResult, attendanceResult] = await Promise.all([
    studentQuery.single(),
    (() => {
      let q = supabase
        .from('homework_submissions')
        .select('id, status, updated_at, homeworks(title, subject, due_date, description)')
        .eq('student_id', studentId)
      if (schoolFilter) q = q.eq('school_id', schoolFilter)
      return q
    })(),
    (() => {
      let q = supabase
        .from('student_notes')
        .select('id, body, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
      if (schoolFilter) q = q.eq('school_id', schoolFilter)
      return q
    })(),
    (() => {
      let q = supabase
        .from('attendance')
        .select('date, status')
        .eq('student_id', studentId)
        .in('status', ['absent', 'late'])
        .gte('date', since90)
        .order('date', { ascending: false })
      if (schoolFilter) q = q.eq('school_id', schoolFilter)
      return q
    })(),
  ])

  if (!studentResult.data) notFound()

  const student = studentResult.data
  const cls = student.classes as unknown as { name: string; grade: number } | null
  const submissions = ((submissionsResult.data ?? []) as unknown as SubmissionRow[]).sort((a, b) =>
    (b.homeworks?.due_date ?? '').localeCompare(a.homeworks?.due_date ?? '')
  )
  const notes      = (notesResult.data ?? []) as NoteRow[]
  const attendance = (attendanceResult.data ?? []) as AttendanceRow[]
  const absentCount = attendance.filter(a => a.status === 'absent').length
  const lateCount   = attendance.filter(a => a.status === 'late').length

  const total = submissions.length
  const done = submissions.filter(s => s.status === 'yapildi').length
  const missing = submissions.filter(s => s.status === 'yapilmadi' || s.status === 'eksik').length
  const rate = total > 0 ? Math.round((done / total) * 100) : 0

  const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const upcoming = submissions.filter(s => (s.homeworks?.due_date ?? '') >= today)
  const past = submissions.filter(s => (s.homeworks?.due_date ?? '') < today)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">EduDesk · Veli Görünümü</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{student.full_name}</p>
            {expiryText && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border mt-1 inline-block ${expiryColor}`}>
                🔗 {expiryText}
              </span>
            )}
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
        <VeliTracker token={token} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center overflow-hidden">
            <p className="text-3xl font-bold text-gray-900">{total}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Toplam Ödev</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center overflow-hidden">
            <p className="text-3xl font-bold text-green-700">{done}</p>
            <p className="text-[10px] sm:text-xs text-green-600 mt-1">Tamamlandı</p>
          </div>
          <div className={`border rounded-2xl p-4 text-center overflow-hidden col-span-2 sm:col-span-1 ${missing > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-3xl font-bold ${missing > 0 ? 'text-red-600' : 'text-gray-400'}`}>{missing}</p>
            <p className={`text-[10px] sm:text-xs mt-1 ${missing > 0 ? 'text-red-500' : 'text-gray-400'}`}>Eksik/Yapılmadı</p>
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
          <section data-veli-section="odevler" className="bg-white border border-gray-200 rounded-2xl p-4">
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
                          {hw?.due_date ? format(parseISO(hw.due_date), 'd MMMM yyyy') : '—'}
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
          <section data-veli-section="odevler" className="bg-white border border-gray-200 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Geçmiş Ödevler</h2>
            <div className="space-y-2">
              {past.map(s => {
                const hw = s.homeworks
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{hw?.title ?? 'Ödev'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {hw?.subject ?? '—'} · {hw?.due_date ? format(parseISO(hw.due_date), 'd MMM yyyy') : '—'}
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

        {(absentCount > 0 || lateCount > 0) && (
          <section data-veli-section="devamsizlik" className="bg-white border border-gray-200 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Devamsızlık — Son 90 Gün</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className={`rounded-xl p-3 text-center ${absentCount > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-2xl font-bold ${absentCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{absentCount}</p>
                <p className={`text-xs mt-0.5 ${absentCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>Gelmedi</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${lateCount > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-2xl font-bold ${lateCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{lateCount}</p>
                <p className={`text-xs mt-0.5 ${lateCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>Geç Geldi</p>
              </div>
            </div>
            {attendance.length > 0 && (
              <div className="space-y-1.5">
                {attendance.slice(0, 10).map(a => (
                  <div key={a.date} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                    <p className="text-sm text-gray-700">{format(parseISO(a.date), 'd MMMM yyyy')}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      a.status === 'absent'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : 'bg-orange-50 text-orange-600 border-orange-200'
                    }`}>
                      {a.status === 'absent' ? 'Gelmedi' : 'Geç Geldi'}
                    </span>
                  </div>
                ))}
                {attendance.length > 10 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    +{attendance.length - 10} kayıt daha
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {notes.length > 0 && (
          <section data-veli-section="notlar" className="bg-white border border-gray-200 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Öğretmen Notları</h2>
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-2">{format(parseISO(n.created_at), 'd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-gray-400 py-4 space-y-1">
          <p>Bu sayfa yalnızca bilgi amaçlıdır · EduDesk</p>
          <p>
            <a href="/gizlilik" target="_blank" className="hover:underline">
              Gizlilik Politikası &amp; KVKK Aydınlatma Metni
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}
