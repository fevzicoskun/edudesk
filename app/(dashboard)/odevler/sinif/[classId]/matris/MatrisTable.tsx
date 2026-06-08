import Link from 'next/link'
import type { SubmissionStatus } from '@/src/shared/types'
import type { Student, Homework, StatEntry } from './types'
import { STATUS_LABEL, CELL_CLS, CELL_DOT, completionColor, dueDateFmt } from './types'

type Props = {
  sortedStudents: Student[]
  homeworks: Homework[]
  subMap: Record<string, SubmissionStatus>
  statsMap: Record<string, StatEntry>
  hwStatsMap: Record<string, StatEntry>
}

export default function MatrisTable({ sortedStudents, homeworks, subMap, statsMap, hwStatsMap }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-b border-r border-gray-200 dark:border-slate-700 px-3 py-3 text-left font-semibold text-gray-600 dark:text-slate-400 min-w-[180px]">
                Öğrenci
              </th>
              {homeworks.map(hw => (
                <th key={hw.id} className="border-b border-r border-gray-200 dark:border-slate-700 px-2 py-2 text-center font-medium text-gray-500 dark:text-slate-500 min-w-[52px] max-w-[64px]">
                  <Link
                    href={`/odevler/${hw.id}`}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title={hw.title}
                  >
                    <div className="text-[10px] font-bold text-gray-700 dark:text-slate-300 leading-tight truncate max-w-[56px]">
                      {hw.subject ?? '—'}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                      {dueDateFmt(hw.due_date)}
                    </div>
                  </Link>
                </th>
              ))}
              <th className="border-b border-gray-200 dark:border-slate-700 px-3 py-3 text-center font-semibold text-gray-600 dark:text-slate-400 min-w-[60px]">
                Oran
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((student, si) => {
              const { done, eligible, pct } = statsMap[student.id]
              return (
                <tr key={student.id} className={si % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-slate-900/20'}>
                  <td className={`sticky left-0 z-10 border-r border-b border-gray-200 dark:border-slate-700 px-3 py-2 font-medium text-gray-800 dark:text-slate-200 ${si % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/70 dark:bg-slate-800/80'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {student.student_number && (
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 w-6 text-right">{student.student_number}</span>
                      )}
                      <span className="truncate max-w-[130px]">{student.full_name}</span>
                    </div>
                  </td>
                  {homeworks.map(hw => {
                    const status = subMap[`${student.id}_${hw.id}`]
                    return (
                      <td key={hw.id} className="border-r border-b border-gray-100 dark:border-slate-700/60 p-1 text-center">
                        {status ? (
                          <span
                            title={STATUS_LABEL[status]}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold ${CELL_CLS[status]}`}
                          >
                            {CELL_DOT[status]}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-50 dark:bg-slate-700/40 text-gray-300 dark:text-slate-600 text-[10px]">·</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="border-b border-gray-200 dark:border-slate-700 px-2 py-2 text-center">
                    {pct === null ? (
                      <span className="text-gray-300 dark:text-slate-600">—</span>
                    ) : (
                      <span className={`font-bold ${completionColor(pct)}`}>%{pct}</span>
                    )}
                    {eligible > 0 && (
                      <div className="text-[10px] text-gray-400 dark:text-slate-500">{done}/{eligible}</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-slate-900/50 border-t-2 border-gray-300 dark:border-slate-600">
              <td className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-r border-gray-200 dark:border-slate-700 px-3 py-2 font-semibold text-gray-600 dark:text-slate-400 text-[11px]">
                Sınıf ortalaması
              </td>
              {homeworks.map(hw => {
                const { pct } = hwStatsMap[hw.id] ?? { pct: null }
                return (
                  <td key={hw.id} className="border-r border-gray-200 dark:border-slate-700 px-2 py-2 text-center">
                    {pct === null ? (
                      <span className="text-gray-300 dark:text-slate-600 text-[10px]">—</span>
                    ) : (
                      <span className={`font-bold text-[11px] ${completionColor(pct)}`}>%{pct}</span>
                    )}
                  </td>
                )
              })}
              <td className="px-2 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-gray-100 dark:border-slate-700 print:hidden">
        {(Object.entries(CELL_DOT) as [SubmissionStatus, string][]).map(([s, dot]) => (
          <span key={s} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${CELL_CLS[s]}`}>{dot}</span>
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-50 dark:bg-slate-700/40 text-gray-300 dark:text-slate-600">·</span>
          Girilmedi
        </span>
      </div>
    </div>
  )
}
