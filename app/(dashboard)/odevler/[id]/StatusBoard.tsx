'use client'

import { useState, useTransition } from 'react'
import { updateAllSubmissionStatuses, updateSubmissionStatus } from '@/app/actions/homework'
import type { SubmissionStatus } from '@/lib/types'

const STATUS_OPTIONS: SubmissionStatus[] = ['yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli']

const LABELS: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı',
  eksik: 'Eksik',
  yapilmadi: 'Yapılmadı',
  gec: 'Geç',
  mazeretli: 'Mazeretli',
}

const STYLES: Record<SubmissionStatus, string> = {
  yapildi: 'bg-green-100 text-green-700 border-green-200',
  eksik: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200',
  gec: 'bg-orange-100 text-orange-700 border-orange-200',
  mazeretli: 'bg-slate-100 text-slate-700 border-slate-200',
}

type StatusItem = {
  student_id: string
  full_name: string
  student_number: string | null
  status: SubmissionStatus
}

export default function StatusBoard({
  homeworkId,
  items,
}: {
  homeworkId: string
  items: StatusItem[]
}) {
  const [statuses, setStatuses] = useState<Record<string, SubmissionStatus>>(() =>
    Object.fromEntries(items.map((item) => [item.student_id, item.status]))
  )
  const [isPending, startTransition] = useTransition()

  function setStatus(studentId: string, next: SubmissionStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: next }))
    startTransition(() => {
      updateSubmissionStatus(homeworkId, studentId, next)
    })
  }

  function setAllStatuses(next: SubmissionStatus) {
    const studentIds = items.map((item) => item.student_id)
    setStatuses(Object.fromEntries(studentIds.map((studentId) => [studentId, next])))
    startTransition(() => {
      updateAllSubmissionStatuses(homeworkId, studentIds, next)
    })
  }

  const counts = STATUS_OPTIONS.reduce(
    (acc, status) => ({
      ...acc,
      [status]: Object.values(statuses).filter((value) => value === status).length,
    }),
    {} as Record<SubmissionStatus, number>
  )

  return (
    <div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Toplu güncelle</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Tüm öğrencileri aynı duruma çek, sonra istisnaları tek tek düzelt.
          </p>
        </div>
        <select
          defaultValue=""
          disabled={isPending}
          onChange={(event) => {
            if (!event.target.value) return
            setAllStatuses(event.target.value as SubmissionStatus)
            event.target.value = ''
          }}
          className="w-full sm:w-48 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Durum seç</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {STATUS_OPTIONS.map((status) => (
          <div key={status} className={`border rounded-xl p-3 text-center ${STYLES[status]}`}>
            <p className="text-2xl font-bold">{counts[status]}</p>
            <p className="text-xs mt-0.5">{LABELS[status]}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const status = statuses[item.student_id] ?? 'yapilmadi'

          return (
            <div
              key={item.student_id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.full_name}</p>
                {item.student_number && (
                  <p className="text-xs text-gray-400 dark:text-slate-500">No: {item.student_number}</p>
                )}
              </div>

              <select
                value={status}
                disabled={isPending}
                onChange={(event) => setStatus(item.student_id, event.target.value as SubmissionStatus)}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 ${STYLES[status]}`}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
