import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { notFound } from 'next/navigation'
import PrintBtn from '../PrintBtn'
import { verifyPublicToken, isTokenRevoked, looksLikeToken } from '@/src/infrastructure/tokens'

const STATUS_LABEL: Record<string, string> = {
  present: 'Var', absent: 'Yok', late: 'Geç', excused: 'Mazeretli',
}
const STATUS_COLOR: Record<string, string> = {
  present: 'text-green-700', absent: 'text-red-700', late: 'text-yellow-700', excused: 'text-blue-700',
}

function TokenExpiredPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <h1 className="text-lg font-bold text-gray-900 mb-2">Link Geçersiz veya Süresi Dolmuş</h1>
        <p className="text-sm text-gray-500">Bu yazdırma linkinin süresi dolmuş. Lütfen uygulamadan yeni link oluşturun.</p>
      </div>
    </div>
  )
}

export default async function YoklamaYazdirTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  if (!looksLikeToken(token)) notFound()

  const supabase = createServiceClient()
  const result = await verifyPublicToken(token, 'yoklama')
  if (!result.ok) return <TokenExpiredPage />
  if (result.payload.jti && await isTokenRevoked(result.payload.jti, supabase)) {
    return <TokenExpiredPage />
  }

  const classId = result.payload.id
  const date = result.payload.m?.date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return <TokenExpiredPage />
  const [classRes, studentsRes, attendanceRes] = await Promise.all([
    supabase.from('classes').select('name, grade').eq('id', classId).single(),
    supabase.from('students').select('id, full_name, student_number').eq('class_id', classId)
      .order('student_number', { nullsFirst: false }).order('full_name'),
    supabase.from('attendance').select('student_id, status').eq('class_id', classId).eq('date', date),
  ])

  const cls = classRes.data
  const students = studentsRes.data ?? []
  const statusMap: Record<string, string> = {}
  for (const r of attendanceRes.data ?? []) statusMap[r.student_id] = r.status

  const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
  })

  const counts = {
    present: students.filter(s => (statusMap[s.id] ?? 'present') === 'present').length,
    absent: students.filter(s => statusMap[s.id] === 'absent').length,
    late: students.filter(s => statusMap[s.id] === 'late').length,
    excused: students.filter(s => statusMap[s.id] === 'excused').length,
  }

  return (
    <div className="max-w-2xl mx-auto p-8 font-sans">
      <div className="flex items-center justify-between mb-8 print:hidden">
        <p className="text-sm text-gray-500">Yazdırmak için aşağıdaki butonu kullanın.</p>
        <PrintBtn />
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{cls?.name ?? '—'} — Yoklama</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{dateFormatted}</p>
      </div>

      <div className="flex gap-6 text-sm mb-6 pb-4 border-b border-gray-200">
        <span className="text-green-700 font-medium">Var: {counts.present}</span>
        <span className="text-red-700 font-medium">Yok: {counts.absent}</span>
        <span className="text-yellow-700 font-medium">Geç: {counts.late}</span>
        <span className="text-blue-700 font-medium">Mazeretli: {counts.excused}</span>
        <span className="text-gray-500 ml-auto">Toplam: {students.length}</span>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-2 pr-4 w-8 font-semibold text-gray-600">#</th>
            <th className="text-left py-2 pr-4 font-semibold text-gray-600">Öğrenci Adı</th>
            <th className="text-left py-2 w-20 font-semibold text-gray-600">No</th>
            <th className="text-left py-2 font-semibold text-gray-600">Durum</th>
            <th className="text-left py-2 font-semibold text-gray-600 w-16 print:block hidden">İmza</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const status = statusMap[s.id] ?? 'present'
            return (
              <tr key={s.id} className={`border-b border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : ''}`}>
                <td className="py-2 pr-4 text-gray-400 text-xs">{i + 1}</td>
                <td className="py-2 pr-4 font-medium text-gray-900">{s.full_name}</td>
                <td className="py-2 text-gray-500 text-xs">{s.student_number ?? '—'}</td>
                <td className={`py-2 font-semibold ${STATUS_COLOR[status] ?? ''}`}>{STATUS_LABEL[status] ?? status}</td>
                <td className="py-2 print:block hidden border-b border-dashed border-gray-300 w-16" />
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="text-xs text-gray-400 mt-10 text-center print:block">
        EduDesk · {cls?.name} · {dateFormatted}
      </p>
    </div>
  )
}
