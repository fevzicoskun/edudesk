'use client'

import { useState, useTransition } from 'react'
import { assignTeacherClass, removeTeacherClass } from '@/app/actions/users'

export type ClassRow = { id: string; name: string; grade: number | null }

export default function TeacherClassModal({
  teacher,
  classes,
  initialAssigned,
}: {
  teacher: { id: string; full_name: string }
  classes: ClassRow[]
  initialAssigned: string[]
}) {
  const [open, setOpen] = useState(false)
  const [assigned, setAssigned] = useState(() => new Set(initialAssigned))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(classId: string) {
    const isAssigned = assigned.has(classId)
    setError(null)
    startTransition(async () => {
      const result = isAssigned
        ? await removeTeacherClass(teacher.id, classId)
        : await assignTeacherClass(teacher.id, classId)

      if (result.error) {
        setError(result.error)
      } else {
        setAssigned(prev => {
          const next = new Set(prev)
          isAssigned ? next.delete(classId) : next.add(classId)
          return next
        })
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Sınıf ata — ${teacher.full_name}`}
        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl p-5 w-80 max-h-[70vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 uppercase tracking-wide">Sınıf Ataması</p>
                <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm mt-0.5">
                  {teacher.full_name}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5 mb-3">
                {error}
              </p>
            )}

            {classes.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-2">Henüz sınıf oluşturulmamış.</p>
            ) : (
              <ul className="space-y-0.5">
                {classes.map(c => (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/60 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={assigned.has(c.id)}
                        onChange={() => toggle(c.id)}
                        disabled={pending}
                        className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300">
                        {c.grade != null ? `${c.grade}. Sınıf — ` : ''}{c.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
              {assigned.size} sınıf atanmış
              {pending && ' · kaydediliyor…'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
