'use client'

import { useState } from 'react'
import type { RiskyStudent } from '@/src/domains/homework/lib/analitik'
import StudentHomeworkProfileModal from '../[id]/StudentHomeworkProfileModal'

export default function OgrenciSicil({ riskyStudents }: { riskyStudents: RiskyStudent[] }) {
  const [selectedId, setSelectedId]           = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string>('')

  if (riskyStudents.length === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-6 text-center">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Tüm öğrenciler düzenli</p>
        <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1">
          3 veya daha fazla eksik/yapılmadı olan öğrenci yok.
        </p>
      </div>
    )
  }

  return (
    <>
      <div>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Riskli Öğrenciler
        </h2>
        <div className="space-y-2">
          {riskyStudents.map(s => (
            <button
              key={s.student_id}
              onClick={() => { setSelectedId(s.student_id); setSelectedClassId(s.class_id) }}
              className="w-full flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-red-200 dark:hover:border-red-800 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{s.full_name}</p>
                {s.student_number && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">No: {s.student_number}</p>
                )}
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
                s.missedCount >= Math.ceil(s.totalHomeworks / 2)
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}>
                {s.missedCount}/{s.totalHomeworks} eksik
              </span>
            </button>
          ))}
        </div>
      </div>

      <StudentHomeworkProfileModal
        studentId={selectedId}
        classId={selectedClassId}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}
