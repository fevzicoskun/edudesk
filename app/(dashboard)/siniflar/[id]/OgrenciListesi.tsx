'use client'

import { useState } from 'react'
import OgrenciKart, { type Student } from './OgrenciKart'

interface Props {
  students: Student[]
  classId: string
  canDelete: boolean
  absenceCounts: Record<string, number>
  warnDays: number
  limitDays: number
  viewCounts?: Record<string, number>
}

export default function OgrenciListesi({ students, classId, canDelete, absenceCounts, warnDays, limitDays, viewCounts }: Props) {
  const [q, setQ] = useState('')

  const filtered = q.trim()
    ? students.filter(
        s =>
          s.full_name.toLowerCase().includes(q.toLowerCase()) ||
          (s.student_number ?? '').includes(q.trim())
      )
    : students

  return (
    <div>
      {students.length > 5 && (
        <div className="relative mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Ad veya numara ara..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-gray-400 text-sm">Sonuç bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => (
            <OgrenciKart
              key={s.id}
              s={s}
              classId={classId}
              canDelete={canDelete}
              index={i}
              absenceCount={absenceCounts[s.id] ?? 0}
              warnDays={warnDays}
              limitDays={limitDays}
              viewCount={viewCounts?.[s.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
