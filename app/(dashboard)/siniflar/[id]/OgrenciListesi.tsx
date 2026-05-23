'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { deleteStudent } from '@/src/domains/classes/actions'

interface Student {
  id: string
  full_name: string
  student_number: string | null
}

interface Props {
  students: Student[]
  classId: string
  canDelete: boolean
}

export default function OgrenciListesi({ students, classId, canDelete }: Props) {
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
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Ad veya numara ara..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-gray-400 text-sm">Sonuç bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => (
            <div
              key={s.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <span className="text-xs text-gray-400 w-6 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/siniflar/${classId}/ogrenciler/${s.id}`}
                  className="text-sm font-medium text-gray-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  {s.full_name}
                </Link>
                {s.student_number && (
                  <p className="text-xs text-gray-400">No: {s.student_number}</p>
                )}
              </div>
              {canDelete && (
                <ConfirmDeleteButton
                  action={deleteStudent.bind(null, s.id, classId)}
                  message={`"${s.full_name}" adlı öğrenciyi ve tüm ödev kayıtlarını silmek istediğine emin misin?`}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
