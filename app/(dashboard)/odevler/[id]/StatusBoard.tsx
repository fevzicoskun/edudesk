'use client'

import { useState, useTransition } from 'react'
import { updateSubmissionStatus } from '@/app/actions/homework'
import type { SubmissionStatus } from '@/lib/types'

const CYCLE: SubmissionStatus[] = ['yapilmadi', 'yapildi', 'eksik']

const LABELS: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı',
  eksik: 'Eksik',
  yapilmadi: 'Yapılmadı',
}

const STYLES: Record<SubmissionStatus, string> = {
  yapildi: 'bg-green-100 text-green-700 hover:bg-green-200',
  eksik: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
  yapilmadi: 'bg-red-100 text-red-700 hover:bg-red-200',
}

type Sub = {
  id: string
  homework_id: string
  student_id: string
  status: string
  note: string | null
  students: { full_name: string; student_number: string | null } | null
}

export default function StatusBoard({
  homeworkId,
  submissions,
}: {
  homeworkId: string
  submissions: Sub[]
}) {
  const [statuses, setStatuses] = useState<Record<string, SubmissionStatus>>(() =>
    Object.fromEntries(
      submissions.map((s) => [s.student_id, s.status as SubmissionStatus])
    )
  )
  const [, startTransition] = useTransition()

  function toggle(studentId: string) {
    const cur = statuses[studentId] ?? 'yapilmadi'
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]
    setStatuses((prev) => ({ ...prev, [studentId]: next }))
    startTransition(() => {
      updateSubmissionStatus(homeworkId, studentId, next)
    })
  }

  const counts = CYCLE.reduce(
    (acc, s) => ({ ...acc, [s]: Object.values(statuses).filter((v) => v === s).length }),
    {} as Record<SubmissionStatus, number>
  )

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {([['yapildi', 'Yapıldı', 'green'], ['eksik', 'Eksik', 'yellow'], ['yapilmadi', 'Yapılmadı', 'red']] as const).map(
          ([key, label, color]) => (
            <div
              key={key}
              className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3 text-center`}
            >
              <p className={`text-2xl font-bold text-${color}-700`}>{counts[key]}</p>
              <p className={`text-xs text-${color}-600 mt-0.5`}>{label}</p>
            </div>
          )
        )}
      </div>

      <div className="space-y-2">
        {submissions.map((sub) => {
          const status = statuses[sub.student_id] ?? 'yapilmadi'
          return (
            <div
              key={sub.id}
              className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {sub.students?.full_name ?? '—'}
                </p>
                {sub.students?.student_number && (
                  <p className="text-xs text-gray-400">{sub.students.student_number}</p>
                )}
              </div>
              <button
                onClick={() => toggle(sub.student_id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ${STYLES[status]}`}
              >
                {LABELS[status]}
              </button>
            </div>
          )
        })}
      </div>

      {submissions.length === 0 && (
        <p className="text-center py-16 text-gray-400 text-sm">
          Bu sınıfta öğrenci yok. Önce sınıfa öğrenci ekleyin.
        </p>
      )}
    </div>
  )
}
