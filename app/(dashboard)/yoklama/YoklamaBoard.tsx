'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { saveAttendance, getAttendanceForDate } from '@/src/domains/attendance/actions'
import type { AttendanceStatus } from '@/src/domains/attendance/types'
import { generateYoklamaToken } from '@/src/domains/tokens/actions'

interface Student { id: string; full_name: string; student_number: string | null }

const STATUS_OPTS: { value: AttendanceStatus; label: string; short: string; style: string; activeStyle: string }[] = [
  { value: 'present',  label: 'Var',       short: 'Var', style: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300', activeStyle: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'absent',   label: 'Yok',       short: 'Yok', style: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300', activeStyle: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  { value: 'late',     label: 'Geç',       short: 'Geç', style: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300', activeStyle: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  { value: 'excused',  label: 'Mazeretli', short: 'Maz', style: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300', activeStyle: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
]

interface Props {
  students: Student[]
  classId: string
  className: string
  todayStr: string
  existing: Record<string, AttendanceStatus>
}

export default function YoklamaBoard({ students, classId, className, todayStr, existing }: Props) {
  const [date, setDate] = useState(todayStr)
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(existing)
  const [saved, setSaved] = useState(false)
  const [, startTransition] = useTransition()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    let cancelled = false
    getAttendanceForDate(classId, date)
      .then(({ data }) => {
        if (cancelled) return
        const next: Record<string, AttendanceStatus> = {}
        for (const r of data ?? []) next[r.student_id] = r.status as AttendanceStatus
        setStatuses(next)
        setSaved(false)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [date, classId])

  const setAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {}
    students.forEach(s => { next[s.id] = status })
    setStatuses(next)
    setSaved(false)
  }

  const toggle = (studentId: string, status: AttendanceStatus) => {
    setStatuses(prev => ({ ...prev, [studentId]: status }))
    setSaved(false)
  }

  const save = () => {
    const records = students.map(s => ({
      studentId: s.id,
      status: statuses[s.id] ?? 'present',
    }))
    startTransition(async () => {
      await saveAttendance(classId, date, records)
      setSaved(true)
    })
  }

  const counts = {
    present: Object.values(statuses).filter(s => s === 'present').length,
    absent: Object.values(statuses).filter(s => s === 'absent').length,
    late: Object.values(statuses).filter(s => s === 'late').length,
    excused: Object.values(statuses).filter(s => s === 'excused').length,
  }

  return (
    <div className="space-y-4">
      {/* Tarih + sınıf başlık */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Sınıf</p>
          <p className="font-semibold text-gray-900 dark:text-slate-100">{className}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Tarih</p>
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); setSaved(false) }}
            className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3 text-xs ml-auto flex-wrap">
          <span className="text-green-600 dark:text-green-400">✅ {counts.present} var</span>
          <span className="text-red-500 dark:text-red-400">❌ {counts.absent} yok</span>
          <span className="text-yellow-600 dark:text-yellow-400">⏱ {counts.late} geç</span>
          <span className="text-blue-600 dark:text-blue-400">📋 {counts.excused} mazeretli</span>
        </div>
      </div>

      {/* Toplu işlem + kaydet */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 dark:text-slate-400">Tümünü:</span>
        {STATUS_OPTS.map(o => (
          <button
            key={o.value}
            onClick={() => setAll(o.value)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${o.activeStyle}`}
          >
            {o.label} yap
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              startTransition(async () => {
                try {
                  const token = await generateYoklamaToken(classId, date)
                  window.open(`/yoklama-yazdir/${token}`, '_blank')
                } catch {
                  alert('Yazdırma linki oluşturulamadı.')
                }
              })
            }}
            disabled={false}
            className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 transition-colors"
          >
            Yazdır
          </button>
          <button
            onClick={save}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {saved ? '✅ Kaydedildi' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Öğrenci listesi */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {students.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm">Bu sınıfta öğrenci yok.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {students.map((s, i) => {
              const current = statuses[s.id] ?? 'present'
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs text-gray-400 dark:text-slate-500 w-6 shrink-0 text-right">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {s.full_name}
                    {s.student_number && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">#{s.student_number}</span>
                    )}
                  </span>
                  <div className="flex gap-0.5 sm:gap-1 shrink-0">
                    {STATUS_OPTS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => toggle(s.id, o.value)}
                        className={`text-xs px-1.5 sm:px-2.5 py-1 rounded-full font-medium transition-colors ${
                          current === o.value ? o.activeStyle : o.style
                        }`}
                      >
                        <span className="sm:hidden">{o.short}</span>
                        <span className="hidden sm:inline">{o.label}</span>
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
