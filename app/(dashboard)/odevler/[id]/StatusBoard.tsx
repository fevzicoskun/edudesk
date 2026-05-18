'use client'

import { useState, useTransition, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { updateAllSubmissionStatuses, updateSubmissionStatus, updateSubmissionNote } from '@/src/domains/homework/actions'
import type { SubmissionStatus } from '@/src/shared/types'

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
  note: string | null
}

export default function StatusBoard({
  homeworkId,
  items,
  homeworkTitle,
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
}) {
  const [statuses, setStatuses] = useState<Record<string, SubmissionStatus>>(() =>
    Object.fromEntries(items.map((item) => [item.student_id, item.status]))
  )
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.student_id, item.note ?? '']))
  )
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function setStatus(studentId: string, next: SubmissionStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: next }))
    startTransition(() => {
      updateSubmissionStatus(homeworkId, studentId, next)
    })
  }

  function saveNote(studentId: string, note: string) {
    setNotes(prev => ({ ...prev, [studentId]: note }))
    startTransition(() => { updateSubmissionNote(homeworkId, studentId, note) })
  }

  function setAllStatuses(next: SubmissionStatus) {
    const studentIds = items.map((item) => item.student_id)
    setStatuses(Object.fromEntries(studentIds.map((studentId) => [studentId, next])))
    startTransition(() => {
      updateAllSubmissionStatuses(homeworkId, studentIds, next)
    })
  }

  function exportToExcel() {
    const rows = items.map((item, i) => [
      i + 1,
      item.student_number ?? '',
      item.full_name,
      LABELS[statuses[item.student_id] ?? 'yapilmadi'],
      notes[item.student_id] ?? '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([
      ['No', 'Numara', 'Ad Soyad', 'Durum', 'Not'],
      ...rows,
    ])
    ws['!cols'] = [{ wch: 4 }, { wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ödevler')
    const filename = homeworkTitle
      ? `${homeworkTitle.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '')}_odev.xlsx`
      : 'odev_durumu.xlsx'
    XLSX.writeFile(wb, filename)
  }

  const counts = useMemo(() => STATUS_OPTIONS.reduce(
    (acc, status) => ({
      ...acc,
      [status]: Object.values(statuses).filter((value) => value === status).length,
    }),
    {} as Record<SubmissionStatus, number>
  ), [statuses])

  return (
    <div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Toplu güncelle</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Tüm öğrencileri aynı duruma çek, sonra istisnaları tek tek düzelt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:text-green-700 dark:hover:text-green-400 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-green-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
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
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.full_name}</p>
                  {item.student_number && (
                    <p className="text-xs text-gray-400 dark:text-slate-500">No: {item.student_number}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedNote(expandedNote === item.student_id ? null : item.student_id)}
                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                      notes[item.student_id]
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 hover:border-gray-300'
                    }`}
                  >
                    {notes[item.student_id] ? '📝 Not' : '+ Not'}
                  </button>
                  <select
                    value={status}
                    disabled={isPending}
                    onChange={(event) => setStatus(item.student_id, event.target.value as SubmissionStatus)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 ${STYLES[status]}`}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{LABELS[option]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {expandedNote === item.student_id && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                  <textarea
                    value={notes[item.student_id] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [item.student_id]: e.target.value }))}
                    onBlur={e => saveNote(item.student_id, e.target.value)}
                    rows={2}
                    placeholder="Öğrenci hakkında kısa not..."
                    className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
