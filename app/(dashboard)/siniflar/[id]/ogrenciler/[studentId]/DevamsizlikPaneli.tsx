import { format, parseISO } from '@/src/shared/date'
import { ATTENDANCE_LIMIT_DAYS, ATTENDANCE_WARN_DAYS } from '@/src/shared/constants/attendance'

type AttendanceRecord = { date: string; status: string }

export default function DevamsizlikPaneli({
  attendanceTableExists,
  attendanceRecords,
  absentDays,
  absentPct,
  absenceDanger,
  absenceWarn,
}: {
  attendanceTableExists: boolean
  attendanceRecords: AttendanceRecord[]
  absentDays: number
  absentPct: number
  absenceDanger: boolean
  absenceWarn: boolean
}) {
  if (!attendanceTableExists) return null

  const statusLabel: Record<string, string> = { absent: 'Yok', late: 'Geç', excused: 'Mazeretli' }
  const statusColor: Record<string, string> = {
    absent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    late:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Yıl İçi Devamsızlık</h2>
        <span className={`text-sm font-bold ${absenceDanger ? 'text-red-500' : absenceWarn ? 'text-yellow-500' : 'text-gray-500 dark:text-slate-400'}`}>
          {absentDays} / {ATTENDANCE_LIMIT_DAYS} gün
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
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
            Devamsızlık Kayıtları ({attendanceRecords.length})
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {attendanceRecords.map((r, i) => (
              <div key={`${r.date}-${r.status}`} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-slate-400">
                  {format(parseISO(r.date), 'd MMM yyyy')}
                </span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] ?? ''}`}>
                  {statusLabel[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
