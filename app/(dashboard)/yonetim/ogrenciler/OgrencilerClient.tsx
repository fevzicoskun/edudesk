'use client'

import { useState, useMemo } from 'react'

interface Student {
  id: string
  full_name: string
  student_number: string | null
}

interface ClassGroup {
  id: string
  name: string
  grade: number
  students: Student[]
}

export default function OgrencilerClient({ classes }: { classes: ClassGroup[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return classes
    return classes
      .map(cls => ({
        ...cls,
        students: cls.students.filter(
          s =>
            s.full_name.toLowerCase().includes(q) ||
            (s.student_number ?? '').toLowerCase().includes(q)
        ),
      }))
      .filter(cls => cls.students.length > 0)
  }, [query, classes])

  const totalVisible = filtered.reduce((acc, c) => acc + c.students.length, 0)
  const totalAll     = classes.reduce((acc, c) => acc + c.students.length, 0)

  return (
    <div className="space-y-4">
      {/* Arama */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="İsim veya numara ara…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Özet */}
      <p className="text-xs text-gray-400 dark:text-slate-500">
        {query ? `${totalVisible} sonuç · ` : ''}{totalAll} öğrenci · {classes.length} sınıf
      </p>

      {/* Sınıf grupları */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
          <p className="text-sm text-gray-400 dark:text-slate-500">Sonuç bulunamadı</p>
        </div>
      ) : (
        filtered.map(cls => (
          <div key={cls.id} className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{cls.name}</span>
              <span className="text-xs text-gray-400 dark:text-slate-500">{cls.students.length} öğrenci</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {cls.students.map(s => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {s.full_name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{s.full_name}</p>
                  </div>
                  {s.student_number && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">#{s.student_number}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
