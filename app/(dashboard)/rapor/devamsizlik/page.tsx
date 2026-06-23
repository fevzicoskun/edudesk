import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { schoolYearStart } from '@/src/shared/utils'
import { AttendanceRepository } from '@/src/domains/attendance/repositories/AttendanceRepository'
import { buildReportRows } from '@/src/domains/attendance/lib/absenceReport'
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'
import DevamsizlikExcelButton from './DevamsizlikExcelButton'

const MUDUR_ROLLER = ['mudur', 'mudur_yardimcisi']

const RISK_BADGE = {
  tehlike: 'bg-red-100 text-red-700 border-red-200',
  uyari:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  takip:   'bg-gray-100 text-gray-600 border-gray-200',
} as const

const RISK_LABEL = {
  tehlike: 'Tehlike',
  uyari:   'Uyarı',
  takip:   'Takipte',
} as const

export const metadata = { title: 'Devamsızlık Raporu' }

export default async function DevamsizlikRaporuPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !MUDUR_ROLLER.includes(profile.role)) {
    redirect('/anasayfa')
  }

  const db    = await createClient()
  const since = schoolYearStart()

  const [counts, { data: studentRows }] = await Promise.all([
    AttendanceRepository.getAbsenceCounts(db, profile.school_id, since),
    db.from('students')
      .select('id, full_name, student_number, classes(name)')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null),
  ])

  const students = (studentRows ?? []).map(s => ({
    id:        s.id,
    fullName:  s.full_name,
    studentNo: s.student_number,
    className: (s.classes as { name: string } | null)?.name ?? '—',
  }))
  const rows = buildReportRows(counts, students)

  const tehlikeCount = rows.filter(r => r.risk === 'tehlike').length
  const uyariCount   = rows.filter(r => r.risk === 'uyari').length
  const takipCount   = rows.filter(r => r.risk === 'takip').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Devamsızlık Raporu</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {since} tarihinden itibaren · Özürsüz devamsızlık sırası
          </p>
        </div>
        <DevamsizlikExcelButton />
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center dark:bg-red-950 dark:border-red-800">
          <p className="text-3xl font-bold text-red-700 dark:text-red-400">{tehlikeCount}</p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">Tehlikede (≥{ATTENDANCE_LIMIT_DAYS}g)</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center dark:bg-yellow-950 dark:border-yellow-800">
          <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{uyariCount}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Uyarıda (≥{ATTENDANCE_WARN_DAYS}g)</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center dark:bg-slate-800 dark:border-slate-700">
          <p className="text-3xl font-bold text-gray-700 dark:text-slate-300">{takipCount}</p>
          <p className="text-xs text-gray-400 mt-1">Takipte</p>
        </div>
      </div>

      {/* Tablo */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">Bu dönemde devamsızlık kaydı bulunmuyor.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
              <tr>
                {['#', 'Ad Soyad', 'Sınıf', 'Özürsüz', 'Özürlü', 'Durum'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 first:w-8 last:w-28">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {rows.map((r, i) => (
                <tr key={r.studentId} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{r.fullName}</p>
                    {r.studentNo && (
                      <p className="text-xs text-gray-500 dark:text-slate-400">No: {r.studentNo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{r.className}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">{r.unexcused}g</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{r.excused}g</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_BADGE[r.risk]}`}>
                      {RISK_LABEL[r.risk]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
