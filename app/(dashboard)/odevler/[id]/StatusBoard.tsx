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
import { STATUS_OPTIONS } from './statusboard/types'
import type { StatusItem } from './statusboard/types'
import { useExcelExport } from './useExcelExport'
import SearchInput from './SearchInput'
import SelectionBar from './statusboard/SelectionBar'

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

  const exportToExcel = useExcelExport({ homeworkTitle, className, dueDate, items, statuses, notes })

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

      <SearchInput show={items.length > 6} value={search} onChange={setSearch} resultCount={filteredItems.length} />

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

      <SelectionBar
        show={selectionMode && selectedIds.size > 0}
        selectedCount={selectedIds.size}
        filteredCount={filteredItems.length}
        isPending={isPending}
        onSelectAll={toggleSelectAll}
        onSetStatus={setSelectedStatuses}
        onCancel={() => { setSelectionMode(false); setSelectedIds(new Set()) }}
      />

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

