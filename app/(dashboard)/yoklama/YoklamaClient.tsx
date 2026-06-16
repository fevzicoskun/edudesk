'use client'

import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from 'react'
import { isYoklamaTimeLocked } from '@/src/shared/constants/attendance'
import type { ClassWithStudents } from './page'
import { getYoklama, saveYoklama, type AttendanceStatus } from '@/app/actions/yoklama'
import type { AbsenceCount } from '@/src/domains/attendance/types'
import { isWeekendISO } from '@/src/domains/attendance/lib/attendanceMath'
import YoklamaLockBanner from './YoklamaLockBanner'
import YoklamaStudentPanel from './YoklamaStudentPanel'

type LockStatus = 'open' | 'time_locked' | 'date_locked'

interface Props {
  classes: ClassWithStudents[]
  absenceCounts: Record<string, AbsenceCount>
  initialStatuses?: Record<string, AttendanceStatus>
  initialDate?: string
  myClassIds?: string[]
  initialClassId?: string
  canEditAfterLock: boolean
  takenTodayIds?: string[]
}

function todayISO() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

function schoolYearStartISO() {
  const today = todayISO()
  const year  = parseInt(today.slice(0, 4))
  const month = parseInt(today.slice(5, 7))
  return `${month >= 9 ? year : year - 1}-09-01`
}

export default function YoklamaClient({ classes, absenceCounts, initialStatuses, initialDate, myClassIds, initialClassId, canEditAfterLock, takenTodayIds }: Props) {
  const [today]           = useState(todayISO)            // mount'ta bir kez
  const [schoolYearStart] = useState(schoolYearStartISO)  // mount'ta bir kez
  const [classId,  setClassId]  = useState(initialClassId ?? classes[0]?.id ?? '')
  const [date,     setDate]     = useState(initialDate ?? today)
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(initialStatuses ?? {})
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState('')
  const [error,    setError]    = useState('')
  const isDirty = useRef(false)
  // Server'dan gelen initialStatuses varsa ilk mount'ta getYoklama çağrısını atla
  const skipInitialLoad = useRef(initialStatuses !== undefined)
  // Kilitleme saati gelince lockStatus yeniden hesaplansın
  const [now, setNow] = useState(() => new Date())
  const [pendingSwitch, setPendingSwitch] = useState<{ type: 'class' | 'date'; value: string } | null>(null)

  function applySwitch(type: 'class' | 'date', value: string) {
    if (type === 'class') setClassId(value)
    else setDate(value)
    isDirty.current = false
    setPendingSwitch(null)
  }

  function trySwitch(type: 'class' | 'date', value: string) {
    if (!isDirty.current) { applySwitch(type, value); return }
    setPendingSwitch({ type, value })
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Toast 5 sn sonra kendiliğinden kapanır
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // Kaydedilmemiş değişiklik varken sekme/tarayıcı kapatılmasını engelle
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty.current) return
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // classId veya date değiştiğinde yoklama yükle — cancellation flag ile race condition önlenir
  useEffect(() => {
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false
      return
    }
    if (!classId) return
    let cancelled = false
    setLoading(true)
    setError('')
    getYoklama(classId, date)
      .then(data => {
        if (cancelled) return
        setStatuses(data)
        isDirty.current = false
      })
      .catch(e => {
        if (cancelled) return
        console.error('[YoklamaClient] loadYoklama:', e)
        setError('Yoklama verileri yüklenemedi')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [classId, date])

  const cls      = classes.find(c => c.id === classId)
  const students = cls?.students ?? []
  const weekend    = isWeekendISO(date)
  const isPastDate = date < today

  const lockStatus = useMemo((): LockStatus => {
    if (canEditAfterLock) return 'open'
    const todayTR = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(now)
    if (date < todayTR) return 'date_locked'
    if (isYoklamaTimeLocked(now)) return 'time_locked'
    return 'open'
  }, [canEditAfterLock, date, now])

  const isLocked = lockStatus !== 'open'

  const [takenToday, setTakenToday] = useState<Set<string>>(() => new Set(takenTodayIds ?? []))

  const isTodayWeekend = useMemo(() => isWeekendISO(today), [today])

  // Araç çubuğu durum sayıları — her toggle'da yeniden hesaplamayı önler
  const statusSummary = useMemo(() => {
    const vals = Object.values(statuses)
    return {
      absent:  vals.filter(s => s === 'absent').length,
      late:    vals.filter(s => s === 'late').length,
      excused: vals.filter(s => s === 'excused').length,
    }
  }, [statuses])

  const handleClassChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    trySwitch('class', e.target.value)
  }, [])

  const handleDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    trySwitch('date', e.target.value)
  }, [])

  function toggle(studentId: string) {
    if (isLocked) return
    isDirty.current = true
    setStatuses(prev => {
      const cur = prev[studentId] ?? 'present'
      const next: AttendanceStatus =
        cur === 'present' ? 'absent'
        : cur === 'absent' ? 'late'
        : cur === 'late'   ? 'excused'
        :                    'present'
      return { ...prev, [studentId]: next }
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setToast('')
    try {
      const entries = students.map(s => ({
        studentId: s.id,
        status:    statuses[s.id] ?? 'present',
      }))
      await saveYoklama(classId, date, entries)
      isDirty.current = false
      const presentCount = entries.filter(e => e.status === 'present').length
      const absentCount  = entries.filter(e => e.status === 'absent').length
      const lateCount    = entries.filter(e => e.status === 'late').length
      const excusedCount = entries.filter(e => e.status === 'excused').length
      const notifyCount  = absentCount + lateCount
      const summary: string[] = []
      if (presentCount > 0) summary.push(`${presentCount} mevcut`)
      if (absentCount  > 0) summary.push(`${absentCount} devamsız`)
      if (lateCount    > 0) summary.push(`${lateCount} geç`)
      if (excusedCount > 0) summary.push(`${excusedCount} özürlü`)
      const parts: string[] = [`Kaydedildi — ${summary.join(', ')}.`]
      if (notifyCount > 0) {
        const sendAt = new Date(Date.now() + 45 * 60 * 1000)
        const saat   = sendAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        parts.push(`Veli bildirimi saat ${saat}'de gönderilecek.`)
      }
      setToast(parts.join(' '))
      if (date === today) {
        setTakenToday(prev => { const s = new Set(prev); s.add(classId); return s })
      }
    } catch (e) {
      console.error('[YoklamaClient] handleSave:', e)
      setError(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const missingClassNames = useMemo(() => {
    if (isTodayWeekend || date !== today) return []
    return classes.filter(c => myClassIds?.includes(c.id) && !takenToday.has(c.id)).map(c => c.name)
  }, [classes, myClassIds, takenToday, isTodayWeekend, date, today])

  const inputCls = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-4">
      {pendingSwitch && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-amber-800 dark:text-amber-300">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-sm flex-1">Kaydedilmemiş değişiklikler var.</span>
          <button
            onClick={() => setPendingSwitch(null)}
            className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
          >
            Geri dön
          </button>
          <button
            onClick={() => applySwitch(pendingSwitch.type, pendingSwitch.value)}
            className="text-xs font-semibold bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
          >
            Devam et ve kaybet
          </button>
        </div>
      )}
      {/* Sınıf + Tarih */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
          <select value={classId} onChange={handleClassChange} className={inputCls}>
            {(() => {
              const mine   = new Set(myClassIds ?? [])
              const my     = classes.filter(c => mine.has(c.id))
              const others = classes.filter(c => !mine.has(c.id))
              const dotLabel = (c: ClassWithStudents) => {
                if (isTodayWeekend || date !== today) return c.name
                return takenToday.has(c.id) ? `${c.name} ✓` : `${c.name} ●`
              }
              if (my.length === 0) return classes.map(c => <option key={c.id} value={c.id}>{dotLabel(c)}</option>)
              return (
                <>
                  <optgroup label="Sınıflarım">
                    {my.map(c => <option key={c.id} value={c.id}>{dotLabel(c)}</option>)}
                  </optgroup>
                  {others.length > 0 && (
                    <optgroup label="Diğer sınıflar">
                      {others.map(c => <option key={c.id} value={c.id}>{dotLabel(c)}</option>)}
                    </optgroup>
                  )}
                </>
              )
            })()}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={handleDateChange}
            max={today}
            min={schoolYearStart}
            className={inputCls}
          />
        </div>
      </div>

      <YoklamaLockBanner
        weekend={weekend}
        isPastDate={isPastDate}
        isLocked={isLocked}
        lockStatus={lockStatus}
        isTodayWeekend={isTodayWeekend}
        date={date}
        today={today}
        missingClassNames={missingClassNames}
      />

      <YoklamaStudentPanel
        loading={loading}
        students={students}
        isLocked={isLocked}
        onDirty={() => { isDirty.current = true }}
        statuses={statuses}
        setStatuses={setStatuses}
        absenceCounts={absenceCounts}
        statusSummary={statusSummary}
        toggle={toggle}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
      {toast && <p className="text-sm text-green-600 dark:text-green-400">{toast}</p>}

      <div className="sticky sticky-above-nav md:bottom-0 md:static bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none pt-2 pb-1 md:py-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || students.length === 0 || weekend || isLocked}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/25 md:shadow-none"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-1.5">
          Butona her tıklayınca: Mevcut → Devamsız → Geç → Özürlü → Mevcut
        </p>
      </div>
    </div>
  )
}
