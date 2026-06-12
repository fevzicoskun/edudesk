'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'

import { updateAllSubmissionStatuses, updateSubmissionStatus, updateSubmissionNote, getSubmissionLogs } from '@/src/domains/homework/actions'
import type { SubmissionStatus } from '@/src/shared/types'
import type { SubmissionLogEntry } from '@/src/domains/homework/repositories/HomeworkRepository'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import StudentHomeworkProfileModal from './StudentHomeworkProfileModal'
import VeliIletisimPaneli from './VeliIletisimPaneli'
import StatusBoardProgress from './statusboard/StatusBoardProgress'
import StatusBoardToolbar from './statusboard/StatusBoardToolbar'
import StudentRow from './statusboard/StudentRow'
import { STATUS_OPTIONS, LABELS, BULK_OPTIONS, STYLES } from './statusboard/types'
import type { StatusItem } from './statusboard/types'

export type { StatusItem }

export default function StatusBoard({
  homeworkId,
  items,
  homeworkTitle,
  totalHomeworks,
  classId,
  dueDate = '',
  className = '',
  weekLoad = null,
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
  totalHomeworks: number
  classId: string
  dueDate?: string
  className?: string
  weekLoad?: ClassWeekLoad | null
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
  const [openBadge, setOpenBadge]           = useState<boolean>(false)
  const [historyOpenId, setHistoryOpenId]   = useState<string | null>(null)
  const [historyMap, setHistoryMap]         = useState<Record<string, SubmissionLogEntry[]>>({})
  const [historyLoadingIds, setHistoryLoadingIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())

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

  function toggleHistory(studentId: string) {
    if (historyOpenId === studentId) { setHistoryOpenId(null); return }
    setHistoryOpenId(studentId)
    if (historyMap[studentId]) return
    setHistoryLoadingIds(cur => new Set([...cur, studentId]))
    startTransition(async () => {
      const logs = await getSubmissionLogs(homeworkId, studentId)
      setHistoryMap(prev => ({ ...prev, [studentId]: logs }))
      setHistoryLoadingIds(cur => { const s = new Set(cur); s.delete(studentId); return s })
    })
  }

  function toggleSelect(studentId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.student_id)))
    }
  }

  function setSelectedStatuses(next: SubmissionStatus) {
    if (selectedIds.size === 0) return
    const ids = [...selectedIds]
    const prevStatuses = { ...statuses }
    setStatuses(s => ({ ...s, ...Object.fromEntries(ids.map(id => [id, next])) }))
    startTransition(async () => {
      const result = await updateAllSubmissionStatuses(homeworkId, ids, next)
      if (result?.error) {
        setStatuses(prevStatuses)
        setErrorMsg(result.error)
      } else {
        setRecordedIds(cur => new Set([...cur, ...ids]))
      }
    })
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  function setAllStatuses(next: SubmissionStatus) {
    const prevAll    = { ...statuses }
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
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Ödev Durumu')
    sheet.columns = [{ width: 6 }, { width: 12 }, { width: 26 }, { width: 16 }, { width: 40 }]

    const infoRows: [string, string][] = [
      ['Ödev', homeworkTitle ?? '—'],
      ['Sınıf', className ?? '—'],
      ['Son Teslim', dueDate ?? '—'],
      ['Tarih', new Date().toLocaleDateString('tr-TR')],
    ]
    infoRows.forEach(([label, value]) => {
      const row = sheet.addRow([label, value])
      row.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } }
      row.getCell(2).font = { bold: true }
    })

    sheet.addRow([])

    const colHeader = sheet.addRow(['No', 'Numara', 'Ad Soyad', 'Durum', 'Not'])
    colHeader.font = { bold: true }
    colHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }

    items.forEach((item, i) => {
      sheet.addRow([i + 1, item.student_number ?? '', item.full_name, LABELS[statuses[item.student_id] ?? 'yapilmadi'], notes[item.student_id] ?? ''])
    })

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
      {openBadge && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenBadge(false)} />
      )}

      <StatusBoardProgress
        recordedCount={recordedCount}
        totalStudents={totalStudents}
        counts={counts}
        weekLoad={weekLoad}
        openBadge={openBadge}
        onToggleBadge={() => setOpenBadge(p => !p)}
      />

      {/* Toplu güncelleme + Excel — aramada gizle */}
      {!search && (
        <StatusBoardToolbar
          isPending={isPending}
          onBulkUpdate={setAllStatuses}
          onExportExcel={exportToExcel}
          selectionMode={selectionMode}
          onToggleSelectMode={() => {
            setSelectionMode(p => !p)
            setSelectedIds(new Set())
          }}
        />
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
        {filteredItems.map(item => (
          <StudentRow
            key={item.student_id}
            item={item}
            status={statuses[item.student_id] ?? 'yapilmadi'}
            note={notes[item.student_id] ?? ''}
            totalHomeworks={totalHomeworks}
            isPending={pendingIds.has(item.student_id)}
            noteSaved={noteSavedId === item.student_id}
            expandedNote={expandedNote}
            historyOpenId={historyOpenId}
            historyLoadingIds={historyLoadingIds}
            historyMap={historyMap}
            onSetStatus={setStatus}
            onToggleNote={id => setExpandedNote(expandedNote === id ? null : id)}
            onNoteChange={(id, val) => setNotes(prev => ({ ...prev, [id]: val }))}
            onNoteBlur={saveNote}
            onToggleHistory={toggleHistory}
            onSelectStudent={setSelectedStudentId}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.student_id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>

      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl px-4 py-3 flex-wrap justify-center">
          <button
            onClick={toggleSelectAll}
            className="text-xs text-gray-300 hover:text-white transition-colors whitespace-nowrap"
          >
            {selectedIds.size === filteredItems.length ? 'Seçimi Temizle' : 'Tümünü Seç'}
          </button>
          <span className="text-sm font-medium whitespace-nowrap">{selectedIds.size} seçildi</span>
          {BULK_OPTIONS.map(status => (
            <button
              key={status}
              disabled={isPending}
              onClick={() => setSelectedStatuses(status)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${STYLES[status]}`}
            >
              {LABELS[status]}
            </button>
          ))}
          <button
            onClick={() => { setSelectionMode(false); setSelectedIds(new Set()) }}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            İptal
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {errorMsg}
        </div>
      )}

      <StudentHomeworkProfileModal
        studentId={selectedStudentId}
        classId={classId}
        weekLoad={weekLoad}
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

