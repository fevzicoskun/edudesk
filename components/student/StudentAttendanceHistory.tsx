'use client'

import { useEffect, useState } from 'react'
import { getStudentAttendanceHistory } from '@/app/actions/yoklama'
import { countAbsences, formatAbsenceBadge } from '@/src/domains/attendance/lib/attendanceMath'

const LABELS: Record<string, string> = { absent: 'Devamsız', late: 'Geç', excused: 'Özürlü' }
const COLORS: Record<string, string> = {
  absent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  late:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

function fmtTR(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default function StudentAttendanceHistory({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<{ date: string; status: string }[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    getStudentAttendanceHistory(studentId)
      .then(data => { if (!cancelled) setRows(data) })
      .catch(e => {
        console.error('[StudentAttendanceHistory]', e)
        if (!cancelled) setError(e instanceof Error ? e.message : 'Yüklenemedi')
      })
    return () => { cancelled = true }
  }, [studentId])

  if (error)         return <p className="text-sm text-red-500 p-3">{error}</p>
  if (rows === null) return <p className="text-sm text-gray-400 p-3">Yükleniyor…</p>
  if (rows.length === 0) return <p className="text-sm text-gray-400 p-3">Bu öğrencinin devamsızlık kaydı yok.</p>

  const c = countAbsences(rows.map(r => ({ ...r, student_id: studentId })))[studentId]
    ?? { unexcused: 0, excused: 0 }

  return (
    <div className="space-y-2 p-1">
      <p className="text-xs text-gray-500 dark:text-slate-400">
        Yıl içi toplam: <strong>{formatAbsenceBadge(c) || '0'}</strong>
        <span className="ml-1">(özürsüz {c.unexcused} gün · özürlü {c.excused} gün)</span>
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
        {rows.map(r => (
          <li key={r.date} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-gray-700 dark:text-slate-300 tabular-nums">{fmtTR(r.date)}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${COLORS[r.status] ?? ''}`}>
              {LABELS[r.status] ?? r.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
