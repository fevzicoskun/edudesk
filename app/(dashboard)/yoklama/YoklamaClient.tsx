'use client'

import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from 'react'
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS, YOKLAMA_LOCK_HOUR, YOKLAMA_LOCK_MINUTE } from '@/src/shared/constants/attendance'
import type { ClassWithStudents } from './page'
import { getYoklama, saveYoklama, type AttendanceStatus } from '@/app/actions/yoklama'
import type { AbsenceCount } from '@/src/domains/attendance/types'
import { formatAbsenceBadge, isWeekendISO } from '@/src/domains/attendance/lib/attendanceMath'
import Tooltip from '@/components/ui/Tooltip'

type LockStatus = 'open' | 'time_locked' | 'date_locked'

interface Props {
  classes: ClassWithStudents[]
  absenceCounts: Record<string, AbsenceCount>
  initialStatuses?: Record<string, AttendanceStatus>
  initialDate?: string
  myClassIds?: string[]
  initialClassId?: string
  canEditAfterLock: boolean
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Mevcut',
  absent:  'Devamsız',
  late:    'Geç',
  excused: 'Özürlü',
}
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-green-500',
  absent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-red-500',
  late:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 ring-yellow-500',
  excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-blue-500',
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

export default function YoklamaClient({ classes, absenceCounts, initialStatuses, initialDate, myClassIds, initialClassId, canEditAfterLock }: Props) {
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
    const now     = new Date()
    const todayTR = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(now)
    if (date < todayTR) return 'date_locked'
    const trHour   = parseInt(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false }).format(now))
    const trMinute = parseInt(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Istanbul', minute: 'numeric' }).format(now))
    if (trHour > YOKLAMA_LOCK_HOUR || (trHour === YOKLAMA_LOCK_HOUR && trMinute >= YOKLAMA_LOCK_MINUTE)) return 'time_locked'
    return 'open'
  }, [canEditAfterLock, date])

  const isLocked = lockStatus !== 'open'

  // Araç çubuğu durum sayıları — her toggle'da yeniden hesaplamayı önler
  const statusSummary = useMemo(() => {
    const vals = Object.values(statuses)
    return {
      absent:  vals.filter(s => s === 'absent').length,
      late:    vals.filter(s => s === 'late').length,
      excused: vals.filter(s => s === 'excused').length,
    }
  }, [statuses])

  const guardDirty = useCallback((): boolean => {
    if (!isDirty.current) return true
    return window.confirm('Kaydedilmemiş değişiklikler var. Devam edilirse kaybolacak.')
  }, [])

  const handleClassChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    if (!guardDirty()) return
    setClassId(e.target.value)
  }, [guardDirty])

  const handleDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (!guardDirty()) return
    setDate(e.target.value)
  }, [guardDirty])

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
    } catch (e) {
      console.error('[YoklamaClient] handleSave:', e)
      setError(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-4">
      {/* Sınıf + Tarih */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
          <select value={classId} onChange={handleClassChange} className={inputCls}>
            {(() => {
              const mine   = new Set(myClassIds ?? [])
              const my     = classes.filter(c => mine.has(c.id))
              const others = classes.filter(c => !mine.has(c.id))
              if (my.length === 0) return classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              return (
                <>
                  <optgroup label="Sınıflarım">
                    {my.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  {others.length > 0 && (
                    <optgroup label="Diğer sınıflar">
                      {others.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

      {weekend && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          <span>⚠️</span>
          <span>Seçilen tarih hafta sonuna denk geliyor. Yoklama alınamaz.</span>
        </div>
      )}

      {isPastDate && !weekend && !isLocked && (
        <div className="flex items-center gap-2 px-4 py-3 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl text-sm text-sky-800 dark:text-sky-300">
          <span>📅</span>
          <span>Geçmiş bir tarih için yoklama giriyorsunuz. Mevcut kayıtların üzerine yazılacak.</span>
        </div>
      )}

      {isLocked && !weekend && (
        <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-800 dark:text-orange-300">
          <span>🔒</span>
          <span>
            {lockStatus === 'time_locked'
              ? `Yoklama düzenleme saati doldu (${YOKLAMA_LOCK_HOUR}:${String(YOKLAMA_LOCK_MINUTE).padStart(2, '0')}). Müdür yardımcısına başvurun.`
              : 'Geçmiş tarih yoklaması düzenlenemez. Müdür yardımcısına başvurun.'}
          </span>
        </div>
      )}

      {/* Öğrenci Listesi */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400">Yükleniyor…</p>
        ) : students.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Bu sınıfta öğrenci yok.</p>
        ) : (
          <>
            {/* Toplu işlem araç çubuğu */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 flex items-center gap-2">
                {students.length} öğrenci
                {statusSummary.absent > 0 && (
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    · {statusSummary.absent} devamsız
                  </span>
                )}
                {statusSummary.late > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400 font-semibold">
                    · {statusSummary.late} geç
                  </span>
                )}
                {statusSummary.excused > 0 && (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    · {statusSummary.excused} özürlü
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => { isDirty.current = true; setStatuses(Object.fromEntries(students.map(s => [s.id, 'present' as AttendanceStatus]))) }}
                  className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Hepsini Mevcut
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => { isDirty.current = true; setStatuses(Object.fromEntries(students.map(s => [s.id, 'absent' as AttendanceStatus]))) }}
                  className="text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Hepsini Devamsız
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => { isDirty.current = true; setStatuses(Object.fromEntries(students.map(s => [s.id, 'excused' as AttendanceStatus]))) }}
                  className="text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Hepsini Özürlü
                </button>
              </div>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-slate-700">
              {students.map((s, i) => {
                const status = statuses[s.id] ?? 'present'
                return (
                  <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-800 dark:text-slate-100 flex items-center gap-1 min-w-0">
                      <span className="text-gray-400 dark:text-slate-500 mr-2 tabular-nums shrink-0">{i + 1}.</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-900 dark:text-slate-100 truncate text-sm">
                          {s.full_name}
                        </span>
                        {(() => {
                          const c = absenceCounts[s.id]
                          if (!c) return null
                          const danger = c.unexcused >= ATTENDANCE_LIMIT_DAYS
                          const warn   = c.unexcused >= ATTENDANCE_WARN_DAYS
                          return (
                            <Tooltip content={`Özürsüz: ${c.unexcused} gün · Özürlü: ${c.excused} gün (MEB sınırı ${ATTENDANCE_LIMIT_DAYS} gün)`}>
                              <span
                                className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                  danger ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                  : warn  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  :         'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                                }`}
                              >
                                {formatAbsenceBadge(c)}
                              </span>
                            </Tooltip>
                          )
                        })()}
                      </div>
                      {s.student_number && <span className="ml-1.5 text-xs text-gray-400 shrink-0">#{s.student_number}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      disabled={isLocked}
                      className={`text-xs font-semibold min-w-[80px] text-center min-h-[44px] px-3 py-2 rounded-xl ring-1 ring-inset transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${STATUS_COLORS[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

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
