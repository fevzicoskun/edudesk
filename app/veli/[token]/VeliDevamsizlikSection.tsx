import { format, parseISO } from '@/src/shared/date'
import VeliDevamsizlikChart from './VeliDevamsizlikChartLazy'

type AttendanceRow = { date: string; status: 'absent' | 'late' }

export default function VeliDevamsizlikSection({
  attendance,
  absentCount,
  lateCount,
}: {
  attendance: AttendanceRow[]
  absentCount: number
  lateCount: number
}) {
  const isEmpty = absentCount === 0 && lateCount === 0

  return (
    <section data-veli-section="devamsizlik" className="bg-white border border-gray-200 rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Devamsızlık — Son 90 Gün</h2>

      {isEmpty ? (
        <div className="flex items-center gap-2 py-3 px-3 bg-emerald-50 border border-emerald-100 rounded-xl">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <p className="text-sm text-emerald-700">Bu dönemde devamsızlık kaydı bulunmuyor.</p>
        </div>
      ) : (
        <>
          <VeliDevamsizlikChart attendance={attendance} />
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
        </>
      )}
    </section>
  )
}
