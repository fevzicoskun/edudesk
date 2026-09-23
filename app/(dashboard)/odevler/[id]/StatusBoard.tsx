'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'

import { updateAllSubmissionStatuses, updateSubmissionStatus, updateSubmissionNote, getSubmissionLogs } from '@/src/domains/homework/actions'
import type { SubmissionStatus } from '@/src/shared/types'
import type { SubmissionLogEntry } from '@/src/domains/homework/repositories/HomeworkRepository'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import StudentHomeworkProfileModal from './StudentHomeworkProfileModal'
import VeliIletisimPaneli from './VeliIletisimPaneli'
import StatusBoardBar from './statusboard/StatusBoardBar'
import StudentRow from './statusboard/StudentRow'
import PrintRapor from './statusboard/PrintRapor'
import { raporSatirlari, raporOzeti } from '@/src/domains/homework/lib/odev-rapor'
import { STATUS_OPTIONS } from './statusboard/types'
import type { StatusItem } from './statusboard/types'
import { useExcelExport } from './useExcelExport'
import SelectionBar from './statusboard/SelectionBar'

export type { StatusItem }

export default function StatusBoard({
  homeworkId,
  items,
  homeworkTitle,
  totalHomeworks,
  classId,
  dueDate = '',
  verilisTarihi = '',
  kontrolTarihi = '',
  className = '',
  weekLoad = null,
  readOnly = false,
  okulAdi = '',
  ders = '',
  ogretmenAdi = '',
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
  totalHomeworks: number
  classId: string
  dueDate?: string
  /** Yazdırma raporu için: ödevin verildiği ve son işaretlendiği gün */
  verilisTarihi?: string
  kontrolTarihi?: string
  className?: string
  weekLoad?: ClassWeekLoad | null
  /** Başkasının ödevi: görüntülenir, yazılamaz */
  readOnly?: boolean
  /** Yalnızca yazdırma raporunun başlığı için */
  okulAdi?: string
  ders?: string
  ogretmenAdi?: string
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
  /** Rapordaki "kontrol edildiği tarih": sunucudan gelen son işaretleme günü,
   *  bu oturumda işaretleme yapılırsa bugüne çekilir (sayfa yenilenmeden yazdırılabiliyor) */
  const [kontrolGunu, setKontrolGunu]       = useState(kontrolTarihi)
  const [openBadge, setOpenBadge]           = useState<boolean>(false)
  const [historyOpenId, setHistoryOpenId]   = useState<string | null>(null)
  const [historyMap, setHistoryMap]         = useState<Record<string, SubmissionLogEntry[]>>({})
  const [historyLoadingIds, setHistoryLoadingIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId]       = useState<string | null>(null)
  /** Son toplu işlemin geri alma bilgisi — "Hepsi yaptı" birincil eylem olduğu için yanlış basmaya karşı */
  const [geriAl, setGeriAl] = useState<{
    onceki: Record<string, SubmissionStatus>
    onceKayitli: Set<string>
  } | null>(null)

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 3500)
    return () => clearTimeout(t)
  }, [errorMsg])

  useEffect(() => {
    if (!geriAl) return
    const t = setTimeout(() => setGeriAl(null), 10_000)
    return () => clearTimeout(t)
  }, [geriAl])

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

  const damgala = () => setKontrolGunu(
    new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  )

  const recordedCount  = recordedIds.size
  const totalStudents  = items.length

  function setStatus(studentId: string, next: SubmissionStatus) {
    if (readOnly || pendingIds.has(studentId)) return
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
        damgala()
      }
    })
  }

  function saveNote(studentId: string, note: string) {
    if (readOnly) return
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
    if (readOnly || selectedIds.size === 0) return
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
        damgala()
      }
    })
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  function setAllStatuses(next: SubmissionStatus) {
    if (readOnly) return
    const prevAll    = { ...statuses }
    const prevKayitli = new Set(recordedIds)
    const studentIds = items.map(i => i.student_id)
    setStatuses(Object.fromEntries(studentIds.map(id => [id, next])))
    startTransition(async () => {
      const result = await updateAllSubmissionStatuses(homeworkId, studentIds, next)
      if (result?.error) {
        setStatuses(prevAll)
        setErrorMsg(result.error)
      } else {
        setRecordedIds(new Set(studentIds))
        damgala()
        // Geri alma yalnız daha önce işaretlenmemiş öğrenci varsa anlamlı
        if (prevKayitli.size < studentIds.length) setGeriAl({ onceki: prevAll, onceKayitli: prevKayitli })
      }
    })
  }

  /** Toplu işlemi geri alır. Eski durumlar farklı olabileceği için duruma göre
   *  gruplanır; ayrıca ÖNCEDEN işaretsiz olanların "işaretlendi" damgası da silinir,
   *  yoksa geri alınmış bir işlem ilerleme göstergesini kalıcı olarak şişirir. */
  function toplumuGeriAl() {
    if (!geriAl || readOnly) return
    const { onceki, onceKayitli } = geriAl
    setGeriAl(null)

    const simdikiDurum   = { ...statuses }
    const simdikiKayitli = new Set(recordedIds)
    setStatuses(onceki)
    setRecordedIds(onceKayitli)

    // (durum, damga-silinsin-mi) ikilisine göre grupla
    const gruplar = new Map<string, { durum: SubmissionStatus; kaldir: boolean; ids: string[] }>()
    for (const [studentId, durum] of Object.entries(onceki)) {
      const kaldir = !onceKayitli.has(studentId)
      const anahtar = `${durum}|${kaldir}`
      const grup = gruplar.get(anahtar) ?? { durum, kaldir, ids: [] }
      grup.ids.push(studentId)
      gruplar.set(anahtar, grup)
    }

    startTransition(async () => {
      for (const { durum, kaldir, ids } of gruplar.values()) {
        const result = await updateAllSubmissionStatuses(homeworkId, ids, durum, kaldir)
        if (result?.error) {
          setStatuses(simdikiDurum)
          setRecordedIds(simdikiKayitli)
          setErrorMsg(result.error)
          return
        }
      }
      damgala()
    })
  }

  const satirlar = useMemo(
    () => raporSatirlari({ items, statuses, notes, recordedIds }),
    [items, statuses, notes, recordedIds],
  )
  const ozet = useMemo(
    () => raporOzeti(statuses, recordedIds, totalStudents),
    [statuses, recordedIds, totalStudents],
  )

  const exportToExcel = useExcelExport({ homeworkTitle, className, dueDate, satirlar })

  return (
    <>
    <div className="print:hidden">
      {readOnly && (
        <div className="mb-4 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm px-4 py-3 rounded-xl">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Bu ödev size ait değil — durumları görüntüleyebilir, değiştiremezsiniz.
        </div>
      )}
      {openBadge && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenBadge(false)} />
      )}

      <StatusBoardBar
        recordedCount={recordedCount}
        totalStudents={totalStudents}
        counts={counts}
        ozet={ozet}
        weekLoad={weekLoad}
        openBadge={openBadge}
        onToggleBadge={() => setOpenBadge(p => !p)}
        isPending={isPending}
        readOnly={readOnly}
        selectionMode={selectionMode}
        onHepsiYapti={() => setAllStatuses('yapildi')}
        onBulkUpdate={setAllStatuses}
        onToggleSelectMode={() => {
          setSelectionMode(p => !p)
          setSelectedIds(new Set())
        }}
        onExportExcel={exportToExcel}
        search={search}
        onSearchChange={setSearch}
        showSearch={items.length > 6}
        resultCount={filteredItems.length}
      />

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
            readOnly={readOnly}
            noteSaved={noteSavedId === item.student_id}
            expandedNote={expandedNote}
            historyOpenId={historyOpenId}
            historyLoadingIds={historyLoadingIds}
            historyMap={historyMap}
            menuOpenId={menuOpenId}
            onToggleMenu={id => setMenuOpenId(cur => cur === id ? null : id)}
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

      {geriAl && !errorMsg && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-slate-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          <span>Tüm sınıf işaretlendi.</span>
          <button
            onClick={toplumuGeriAl}
            className="font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
          >
            Geri al
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

    <PrintRapor
      okulAdi={okulAdi}
      odevBasligi={homeworkTitle ?? ''}
      sinif={className}
      ders={ders}
      verilisTarihi={verilisTarihi}
      sonTeslim={dueDate}
      kontrolTarihi={kontrolGunu}
      ogretmenAdi={ogretmenAdi}
      satirlar={satirlar}
      ozet={ozet}
    />
    </>
  )
}

