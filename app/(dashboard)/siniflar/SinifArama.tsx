'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { deleteClass } from '@/app/actions/class'

interface Cls {
  id: string
  name: string
  grade: number
  students: { id: string }[]
}

export default function SinifArama({ classes }: { classes: Cls[] }) {
  const [q, setQ] = useState('')
  const filtered = q.trim()
    ? classes.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : classes

  return (
    <div>
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Sınıf ara (9-A, 10-B...)"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-center py-8 text-gray-400 text-sm">Sonuç bulunamadı.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => {
            const studentCount = Array.isArray(c.students) ? c.students.length : 0
            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/siniflar/${c.id}`} className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">{c.name}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{studentCount} öğrenci</p>
                  </Link>
                  <ConfirmDeleteButton
                    action={deleteClass.bind(null, c.id)}
                    message="Bu sınıfı ve tüm öğrencilerini, ödevlerini silmek istediğine emin misin?"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
