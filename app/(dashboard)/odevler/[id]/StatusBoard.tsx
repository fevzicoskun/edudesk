'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import ExcelJS from 'exceljs'
import { updateAllSubmissionStatuses, updateSubmissionStatus, updateSubmissionNote } from '@/src/domains/homework/actions'
import type { SubmissionStatus } from '@/src/shared/types'
import StudentHomeworkProfileModal from './StudentHomeworkProfileModal'
import VeliIletisimPaneli from './VeliIletisimPaneli'

const STATUS_OPTIONS: SubmissionStatus[] = ['yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli']
const BULK_OPTIONS: SubmissionStatus[]   = ['yapildi', 'yapilmadi', 'eksik']

const LABELS: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç', mazeretli: 'Mazeretli',
}

const STYLES: Record<SubmissionStatus, string> = {
  yapildi:   'bg-green-100 text-green-700 border-green-200',
  eksik:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200',
  gec:       'bg-orange-100 text-orange-700 border-orange-200',
  mazeretli: 'bg-slate-100 text-slate-700 border-slate-200',
}

const BAR_COLORS: Record<SubmissionStatus, string> = {
  yapildi:   'bg-emerald-500',
  eksik:     'bg-amber-400',
  yapilmadi: 'bg-red-400',
  gec:       'bg-orange-400',
  mazeretli: 'bg-slate-300',
}

type StatusItem = {
  student_id: string
  full_name: string
  student_number: string | null
  status: SubmissionStatus
  note: string | null
  hasRecord: boolean
  missedCount: number
  totalHomeworks: number
  veli_telefon: string | null
  veli_ad: string | null
  veli_email: string | null
}

export default function StatusBoard({
  homeworkId,
  items,
  homeworkTitle,
  totalHomeworks,
  classId,
  dueDate = '',
  className = '',
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
  totalHomeworks: number
  classId: string
  dueDate?: string
  className?: string
}) {
  const [statuses, setStatuses] = useState<Record<string, SubmissionStatus>>(() =>
    Object.fromEntries(items.map(i => [i.student_id, i.status]))
  )
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map(i => [i.student_id, i.note ?? '']))
  )
  const [expandedNote, setExpandedNote]     = useState<string | null>(null)
  const [isPending, startTransition]        = useTransition()
  const [pendingIds, setPendingIds]         = useState<Set<string>>(new Set())
  const [noteSavedId, setNoteSavedId]       = useState<string | null>(null)
  const [errorMsg, setErrorMsg]             = useState<string | null>(null)
  const [search, setSearch]                 = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [recordedIds, setRecordedIds]       = useState<Set<string>>(
    () => new Set(items.filter(i => i.hasRecord).map(i => i.student_id))
  )

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 3500)
    return () => clearTimeout(t)
  }, [errorMsg])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(i =>
      i.full_name.toLowerCase().includes(q) ||
      (i.student_number ?? '').toLowerCase().includes(q)
    )
  }, [items, search])

  const counts = useMemo(() =>
    STATUS_OPTIONS.reduce(
      (acc, s) => ({ ...acc, [s]: Object.values(statuses).filter(v => v === s).length }),
      {} as Record<SubmissionStatus, number>
    ),
    [statuses]
  )

  const recordedCount  = recordedIds.size
  const totalStudents  = items.length
  const progressPct    = totalStudents === 0 ? 0 : Math.round(recordedCount / totalStudents * 100)

  // Segmented bar widths
  const pct = (n: number) => totalStudents === 0 ? 0 : (n / totalStudents) * 100
  const unrecordedCount = Math.max(0, totalStudents - recordedCount)

  function setStatus(studentId: string, next: SubmissionStatus) {
    if (pendingIds.has(studentId)) return
    const oldStatus = statuses[studentId] ?? 'yapilmadi'
    setStatuses(s => ({ ...s, [studentId]: next }))
    setPendingIds(cur => new Set([...cur, studentId]))
    startTransition(async () => {
      const result = await updateSubmissionStatus(homeworkId, studentId, next)
      setPendingIds(cur => { const s = new Set(cur); s.delete(studentId); return s })
      if (result?.error) {
        setStatuses(s => ({ ...s, [studentId]: oldStatus }))
        setErrorMsg(result.error)
      } else {
        setRecordedIds(cur => new Set([...cur, studentId]))
      }
    })
  }

  function saveNote(studentId: string, note: string) {
    setNotes(prev => ({ ...prev, [studentId]: note }))
    startTransition(async () => {
      const result = await updateSubmissionNote(homeworkId, studentId, note)
      if (result?.error) {
        setErrorMsg(result.error)
      } else {
        setNoteSavedId(studentId)
        setTimeout(() => setNoteSavedId(id => id === studentId ? null : id), 2000)
      }
    })
  }

  function setAllStatuses(next: SubmissionStatus) {
    const prevAll   = { ...statuses }
    const studentIds = items.map(i => i.student_id)
    setStatuses(Object.fromEntries(studentIds.map(id => [id, next])))
    startTransition(async () => {
      const result = await updateAllSubmissionStatuses(homeworkId, studentIds, next)
      if (result?.error) {
        setStatuses(prevAll)
        setErrorMsg(result.error)
      } else {
        setRecordedIds(new Set(studentIds))
      }
    })
  }

  async function exportToExcel() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Ödevler')
    sheet.addRow(['No', 'Numara', 'Ad Soyad', 'Durum', 'Not'])
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }
    items.forEach((item, i) => {
      sheet.addRow([i + 1, item.student_number ?? '', item.full_name, LABELS[statuses[item.student_id] ?? 'yapilmadi'], notes[item.student_id] ?? ''])
    })
    sheet.columns = [{ width: 6 }, { width: 12 }, { width: 26 }, { width: 16 }, { width: 32 }]
    const buffer = await workbook.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a')
    a.href = url
    a.download = homeworkTitle ? `${homeworkTitle.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '')}_odev.xlsx` : 'odev_durumu.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>

      {/* Tamamlanma özet barı */}
      <div className="mb-5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-gray-600 dark:text-slate-400">
            {recordedCount}/{totalStudents} öğrenci işaretlendi
          </span>
          <span className={`font-bold text-base ${progressPct === 100 ? 'text-emerald-600' : progressPct >= 60 ? 'text-amber-600' : 'text-gray-400'}`}>
            %{progressPct}
          </span>
        </div>
        {/* Segmented bar */}
        <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${pct(counts.yapildi)}%` }} />
          <div className="bg-orange-400  h-full transition-all duration-500" style={{ width: `${pct(counts.gec)}%` }} />
          <div className="bg-amber-400   h-full transition-all duration-500" style={{ width: `${pct(counts.eksik)}%` }} />
          <div className="bg-red-400     h-full transition-all duration-500" style={{ width: `${pct(Math.max(0, counts.yapilmadi - unrecordedCount))}%` }} />
          <div className="bg-slate-300   h-full transition-all duration-500" style={{ width: `${pct(counts.mazeretli)}%` }} />
        </div>
        {/* Sayım satırı */}
        <div className="flex flex-wrap gap-3 mt-2.5">
          {STATUS_OPTIONS.map(s => (
            <span key={s} className="flex items-center gap-1 text-xs">
              <span className={`w-2 h-2 rounded-full ${BAR_COLORS[s]}`} />
              <span className="text-gray-500 dark:text-slate-400">{LABELS[s]}: <strong className="text-gray-800 dark:text-slate-200">{counts[s]}</strong></span>
            </span>
          ))}
          {unrecordedCount > 0 && (
            <span className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-slate-600" />
              <span className="text-gray-400 dark:text-slate-500">Girilmedi: <strong>{unrecordedCount}</strong></span>
            </span>
          )}
        </div>
      </div>

      {/* Toplu güncelleme + Excel — aramada gizle */}
      {!search && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-4">
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
            {BULK_OPTIONS.map(option => (
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
      )}

      {/* Öğrenci arama */}
      {items.length > 6 && (
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Öğrenci ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 placeholder:text-gray-400 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Arama sonucu bilgisi */}
      {search && (
        <p className="text-xs text-gray-400 mb-3">
          {filteredItems.length === 0 ? 'Sonuç bulunamadı.' : `${filteredItems.length} öğrenci gösteriliyor`}
        </p>
      )}

      {/* Öğrenci listesi */}
      <div className="space-y-2">
        {filteredItems.map(item => {
          const status      = statuses[item.student_id] ?? 'yapilmadi'
          const hasNote     = !!notes[item.student_id]
          const isItemPending = pendingIds.has(item.student_id)
          const noteSaved   = noteSavedId === item.student_id

          return (
            <div
              key={item.student_id}
              className={`bg-white dark:bg-slate-800 border rounded-xl px-4 py-3 transition-colors ${
                isItemPending ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-slate-700'
              }`}
            >
              {/* Üst satır: isim + not butonu */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0 pt-0.5">
                  <button
                    onClick={() => setSelectedStudentId(item.student_id)}
                    className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {item.full_name}
                  </button>
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
                    {isItemPending && (
                      <svg className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedNote(expandedNote === item.student_id ? null : item.student_id)}
                  className={`shrink-0 text-xs px-2.5 min-h-[44px] min-w-[72px] rounded-lg border transition-colors ${
                    noteSaved
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : hasNote
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 hover:border-gray-300'
                  }`}
                >
                  {noteSaved ? '✓ Kaydedildi' : hasNote ? 'Not ✓' : '+ Not'}
                </button>
              </div>

              {/* Durum butonları — 3+2 grid, min-h-[44px] WCAG dokunma hedefi */}
              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                {(['yapildi', 'eksik', 'yapilmadi'] as SubmissionStatus[]).map(option => (
                  <button
                    key={option}
                    disabled={isItemPending}
                    onClick={() => setStatus(item.student_id, option)}
                    className={`text-xs px-2 rounded-xl border transition-colors min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed ${
                      status === option
                        ? `${STYLES[option]} ring-2 ring-current font-bold`
                        : 'font-medium bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                    }`}
                  >
                    {LABELS[option]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['gec', 'mazeretli'] as SubmissionStatus[]).map(option => (
                  <button
                    key={option}
                    disabled={isItemPending}
                    onClick={() => setStatus(item.student_id, option)}
                    className={`text-xs px-2 rounded-xl border transition-colors min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed ${
                      status === option
                        ? `${STYLES[option]} ring-2 ring-current font-bold`
                        : 'font-medium bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {errorMsg}
        </div>
      )}

      <StudentHomeworkProfileModal
        studentId={selectedStudentId}
        classId={classId}
        onClose={() => setSelectedStudentId(null)}
      />

      <VeliIletisimPaneli
        homeworkId={homeworkId}
        homeworkTitle={homeworkTitle ?? ''}
        dueDate={dueDate}
        items={items.map(i => ({
          student_id:     i.student_id,
          full_name:      i.full_name,
          student_number: i.student_number,
          status:         statuses[i.student_id] ?? i.status,
          veli_telefon:   i.veli_telefon,
          veli_ad:        i.veli_ad,
          veli_email:     i.veli_email,
        }))}
      />
    </div>
  )
}
