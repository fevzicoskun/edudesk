import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import YoklamaExcelExport from './YoklamaExcelExport'

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  absent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  late:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}
const STATUS_ABBR: Record<string, string> = {
  present: 'V', absent: 'Y', late: 'G', excused: 'M',
}

const MEB_LIMIT = 20
const MEB_WARN  = 15

interface Student { id: string; full_name: string; student_number: string | null }
interface AttRec   { student_id: string; date: string; status: string }
interface Props {
  students: Student[]
  allRecords: AttRec[]
  gridDates: string[]
  className: string
}

export default function YoklamaGecmis({ students, allRecords, gridDates, className }: Props) {
  const lookup = new Map<string, Map<string, string>>()
  const absent = new Map<string, number>()

  for (const r of allRecords) {
    if (r.status === 'absent') {
      absent.set(r.student_id, (absent.get(r.student_id) ?? 0) + 1)
    } else if (r.status === 'late') {
      absent.set(r.student_id, (absent.get(r.student_id) ?? 0) + 0.5)
    }
    if (gridDates.includes(r.date)) {
      if (!lookup.has(r.student_id)) lookup.set(r.student_id, new Map())
      lookup.get(r.student_id)!.set(r.date, r.status)
    }
  }

  const sorted = [...students].sort(
    (a, b) => (absent.get(b.id) ?? 0) - (absent.get(a.id) ?? 0)
  )

  return (
    <div className="space-y-5">
      {/* Devamsızlık özeti */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            {className} — Yıl İçi Devamsızlık
          </h2>
          <YoklamaExcelExport students={students} allRecords={allRecords} className={className} />
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
          MEB sınırı: {MEB_LIMIT} gün · Geç giriş = 0,5 gün
        </p>
        <div className="space-y-2.5">
          {sorted.map(s => {
            const count = absent.get(s.id) ?? 0
            const pct   = Math.min((count / MEB_LIMIT) * 100, 100)
            const danger  = count >= MEB_LIMIT
            const warning = count >= MEB_WARN && !danger
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-700 dark:text-slate-300 w-40 truncate shrink-0">
                  {s.full_name}
                </span>
                <div className="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      danger ? 'bg-red-500' : warning ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs font-semibold w-28 text-right shrink-0 ${
                  danger  ? 'text-red-600 dark:text-red-400' :
                  warning ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-gray-500 dark:text-slate-400'
                }`}>
                  {danger ? '🚨 ' : warning ? '⚠️ ' : ''}{count} / {MEB_LIMIT} gün
                </span>
              </div>
            )
          })}
        </div>
        {sorted.some(s => (absent.get(s.id) ?? 0) >= MEB_WARN) && (
          <div className="mt-4 text-xs text-gray-500 dark:text-slate-400 space-y-0.5">
            <p>⚠️ = {MEB_WARN} güne ulaştı, limit yakın</p>
            <p>🚨 = {MEB_LIMIT} gün sınırı aşıldı — veliye bildirim gerekebilir</p>
          </div>
        )}
      </div>

      {/* Günlük ızgara — son 14 gün */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Son 14 Gün</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-slate-400 min-w-[140px] sticky left-0 bg-white dark:bg-slate-900">
                  Öğrenci
                </th>
                {gridDates.map(d => (
                  <th key={d} className="px-1 py-2 text-center font-medium text-gray-500 dark:text-slate-400 min-w-[38px]">
                    <div className="font-semibold">{format(parseISO(d), 'd', { locale: tr })}</div>
                    <div className="text-[10px] text-gray-400 dark:text-slate-500">
                      {format(parseISO(d), 'EEE', { locale: tr })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {sorted.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-slate-100 truncate max-w-[140px] sticky left-0 bg-white dark:bg-slate-900">
                    {s.full_name}
                  </td>
                  {gridDates.map(d => {
                    const status = lookup.get(s.id)?.get(d)
                    return (
                      <td key={d} className="px-1 py-2 text-center">
                        {status ? (
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold ${STATUS_COLORS[status] ?? ''}`}>
                            {STATUS_ABBR[status] ?? '?'}
                          </span>
                        ) : (
                          <span className="text-gray-200 dark:text-slate-700 text-base">·</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-700 flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-slate-400">
          {[
            { abbr: 'V', label: 'Var',       cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
            { abbr: 'Y', label: 'Yok',       cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
            { abbr: 'G', label: 'Geç (0.5)', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
            { abbr: 'M', label: 'Mazeretli', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
          ].map(({ abbr, label, cls }) => (
            <span key={abbr} className="flex items-center gap-1">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${cls}`}>{abbr}</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
