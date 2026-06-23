'use client'

import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'
import type { AttendanceStatus } from '@/app/actions/yoklama'
import type { AbsenceCount } from '@/src/domains/attendance/types'
import { formatAbsenceBadge } from '@/src/domains/attendance/lib/attendanceMath'
import Tooltip from '@/components/ui/Tooltip'

type Student = { id: string; full_name: string; student_number: string | null }

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Mevcut',
  absent:  'Devamsız',
  late:    'Geç',
  excused: 'Özürlü',
}

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-green-500',
  absent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-red-500',
  late:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 ring-yellow-500',
  excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-blue-500',
}

const STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: 'Mevcut',
  absent:  'Dev.',
  late:    'Geç',
  excused: 'Özür.',
}

export default function YoklamaStudentPanel({
  loading, students, isLocked, onDirty, statuses, setStatuses, absenceCounts, statusSummary, setStatus,
}: {
  loading: boolean
  students: Student[]
  isLocked: boolean
  onDirty: () => void
  statuses: Record<string, AttendanceStatus>
  setStatuses: React.Dispatch<React.SetStateAction<Record<string, AttendanceStatus>>>
  absenceCounts: Record<string, AbsenceCount>
  statusSummary: { absent: number; late: number; excused: number }
  setStatus: (studentId: string, status: AttendanceStatus) => void
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {loading ? (
        <p className="p-6 text-center text-sm text-gray-400">Yükleniyor…</p>
      ) : students.length === 0 ? (
        <p className="p-6 text-center text-sm text-gray-400">Bu sınıfta öğrenci yok.</p>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 flex items-center gap-2">
              {students.length} öğrenci
              {statusSummary.absent > 0 && (
                <span className="text-red-600 dark:text-red-400 font-semibold">· {statusSummary.absent} devamsız</span>
              )}
              {statusSummary.late > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400 font-semibold">· {statusSummary.late} geç</span>
              )}
              {statusSummary.excused > 0 && (
                <span className="text-blue-600 dark:text-blue-400 font-semibold">· {statusSummary.excused} özürlü</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button" disabled={isLocked}
                onClick={() => { onDirty(); setStatuses(Object.fromEntries(students.map(s => [s.id, 'present' as AttendanceStatus]))) }}
                className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >Hepsini Mevcut</button>
              <button
                type="button" disabled={isLocked}
                onClick={() => { onDirty(); setStatuses(Object.fromEntries(students.map(s => [s.id, 'absent' as AttendanceStatus]))) }}
                className="text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >Hepsini Devamsız</button>
              <button
                type="button" disabled={isLocked}
                onClick={() => { onDirty(); setStatuses(Object.fromEntries(students.map(s => [s.id, 'excused' as AttendanceStatus]))) }}
                className="text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >Hepsini Özürlü</button>
            </div>
          </div>

          <ul className="divide-y divide-gray-100 dark:divide-slate-700">
            {students.map((s, i) => {
              const status = statuses[s.id] ?? 'present'
              return (
                <li key={s.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-1 min-w-0 mb-2">
                    <span className="text-gray-500 dark:text-slate-400 mr-2 tabular-nums shrink-0 text-sm">{i + 1}.</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-900 dark:text-slate-100 truncate text-sm">{s.full_name}</span>
                      {(() => {
                        const c = absenceCounts[s.id]
                        if (!c) return null
                        const danger = c.unexcused >= ATTENDANCE_LIMIT_DAYS
                        const warn   = c.unexcused >= ATTENDANCE_WARN_DAYS
                        return (
                          <Tooltip content={`Özürsüz: ${c.unexcused} gün · Özürlü: ${c.excused} gün (MEB sınırı ${ATTENDANCE_LIMIT_DAYS} gün)`}>
                            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              danger ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : warn  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              :         'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                            }`}>
                              {formatAbsenceBadge(c)}
                            </span>
                          </Tooltip>
                        )
                      })()}
                    </div>
                    {s.student_number && <span className="ml-1.5 text-xs text-gray-500 dark:text-slate-400 shrink-0">#{s.student_number}</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setStatus(s.id, opt)}
                        disabled={isLocked}
                        className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-semibold ring-inset transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed ${
                          status === opt
                            ? `${STATUS_COLORS[opt]} ring-2`
                            : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200 dark:bg-slate-700/50 dark:text-slate-400 dark:ring-slate-600 hover:ring-gray-300 dark:hover:ring-slate-500'
                        }`}
                      >
                        <span className="md:hidden">{STATUS_SHORT[opt]}</span>
                        <span className="hidden md:inline">{STATUS_LABELS[opt]}</span>
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
