'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import ExcelJS from 'exceljs'
import { updateAllSubmissionStatuses, updateSubmissionStatus, updateSubmissionNote } from '@/src/domains/homework/actions'
import type { SubmissionStatus } from '@/src/shared/types'

const STATUS_OPTIONS: SubmissionStatus[] = ['yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli']
const BULK_OPTIONS: SubmissionStatus[]   = ['yapildi', 'yapilmadi', 'eksik']

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
  missedCount: number
  totalHomeworks: number
}

export default function StatusBoard({
  homeworkId,
  items,
  homeworkTitle,
  totalHomeworks,
  initialRecordCount,
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
  totalHomeworks: number
  initialRecordCount: number
}) {
  const [statuses, setStatuses] = useState<Record<string, SubmissionStatus>>(() =>
    Object.fromEntries(items.map((item) => [item.student_id, item.status]))
  )
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.student_id, item.note ?? '']))
  )
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [hasInteracted, setHasInteracted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const showCounts = initialRecordCount > 0 || hasInteracted

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 3000)
    return () => clearTimeout(t)
  }, [errorMsg])

  function setStatus(studentId: string, next: SubmissionStatus) {
    setHasInteracted(true)
    const prev = statuses[studentId] ?? 'yapilmadi'
    setStatuses(s => ({ ...s, [studentId]: next }))
    startTransition(async () => {
      const result = await updateSubmissionStatus(homeworkId, studentId, next)
      if (result?.error) {
        setStatuses(s => ({ ...s, [studentId]: prev }))
        setErrorMsg(result.error)
      }
    })
  }

  function saveNote(studentId: string, note: string) {
    setNotes(prev => ({ ...prev, [studentId]: note }))
    startTransition(() => { updateSubmissionNote(homeworkId, studentId, note) })
  }

  function setAllStatuses(next: SubmissionStatus) {
    setHasInteracted(true)
    const prevAll = { ...statuses }
    const studentIds = items.map((item) => item.student_id)
    setStatuses(Object.fromEntries(studentIds.map((studentId) => [studentId, next])))
    startTransition(async () => {
      const result = await updateAllSubmissionStatuses(homeworkId, studentIds, next)
      if (result?.error) {
        setStatuses(prevAll)
        setErrorMsg(result.error)
      }
    })
  }

  async function exportToExcel() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Ödevler')

    const headers = ['No', 'Numara', 'Ad Soyad', 'Durum', 'Not']
    sheet.addRow(headers)
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAD3' },
    }

    items.forEach((item, i) => {
      sheet.addRow([
        i + 1,
        item.student_number ?? '',
        item.full_name,
        LABELS[statuses[item.student_id] ?? 'yapilmadi'],
        notes[item.student_id] ?? '',
      ])
    })

    sheet.columns = [
      { width: 6 },
      { width: 12 },
      { width: 26 },
      { width: 16 },
      { width: 32 },
    ]

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = homeworkTitle
      ? `${homeworkTitle.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '')}_odev.xlsx`
      : 'odev_durumu.xlsx'
    a.click()
    URL.revokeObjectURL(url)
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

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-5">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tümünü güncelle</p>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-green-700 dark:hover:text-green-400 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-green-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BULK_OPTIONS.map((option) => (
            <button
              key={option}
              disabled={isPending}
              onClick={() => setAllStatuses(option)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${STYLES[option]}`}
            >
              Tümü {LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {showCounts ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {STATUS_OPTIONS.map((status) => (
            <div key={status} className={`border rounded-xl p-3 text-center ${STYLES[status]}`}>
              <p className="text-2xl font-bold">{counts[status]}</p>
              <p className="text-xs mt-0.5">{LABELS[status]}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4 mb-5">
          Henüz giriş yapılmadı — öğrenci durumlarını aşağıdan işaretleyin.
        </p>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const status = statuses[item.student_id] ?? 'yapilmadi'
          const hasNote = !!notes[item.student_id]

          return (
            <div
              key={item.student_id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3"
            >
              {/* Üst satır: isim + not butonu */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.student_number && (
                      <span className="text-xs text-gray-400 dark:text-slate-500">No: {item.student_number}</span>
                    )}
                    {totalHomeworks > 0 && item.missedCount > 0 && (
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                        item.missedCount >= Math.ceil(totalHomeworks * 0.5)
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                          : item.missedCount >= 3
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {item.missedCount}/{totalHomeworks} eksik
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedNote(expandedNote === item.student_id ? null : item.student_id)}
                  disabled={false}
                  className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    hasNote
                      ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 hover:border-gray-300'
                  }`}
                >
                  {hasNote ? 'Not ✓' : '+ Not'}
                </button>
              </div>

              {/* Durum chip butonları */}
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option}
                    disabled={isPending}
                    onClick={() => setStatus(item.student_id, option)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:cursor-not-allowed ${
                      status === option
                        ? STYLES[option]
                        : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                    }`}
                  >
                    {LABELS[option]}
                  </button>
                ))}
              </div>

              {expandedNote === item.student_id && (
                <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-700">
                  <textarea
                    value={notes[item.student_id] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [item.student_id]: e.target.value }))}
                    onBlur={e => saveNote(item.student_id, e.target.value)}
                    rows={2}
                    placeholder="Öğrenci hakkında kısa not..."
                    className="w-full px-3 py-2 text-base border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {errorMsg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg"
          onAnimationEnd={() => setErrorMsg(null)}
        >
          {errorMsg}
        </div>
      )}
    </div>
  )
}
