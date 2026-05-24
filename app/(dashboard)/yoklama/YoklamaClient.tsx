'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ClassWithStudents } from './page'
import { getYoklama, saveYoklama, type AttendanceStatus } from '@/app/actions/yoklama'

interface Props { classes: ClassWithStudents[] }

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Mevcut',
  absent:  'Devamsız',
  late:    'Geç',
}
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-green-500',
  absent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-red-500',
  late:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 ring-yellow-500',
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

export default function YoklamaClient({ classes }: Props) {
  const [classId,   setClassId]   = useState(classes[0]?.id ?? '')
  const [date,      setDate]      = useState(todayISO())
  const [statuses,  setStatuses]  = useState<Record<string, AttendanceStatus>>({})
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState('')
  const [error,     setError]     = useState('')

  const cls = classes.find(c => c.id === classId)
  const students = cls?.students ?? []

  const loadYoklama = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    setError('')
    try {
      const data = await getYoklama(classId, date)
      setStatuses(data)
    } catch {
      setError('Yoklama verileri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [classId, date])

  useEffect(() => { loadYoklama() }, [loadYoklama])

  function toggle(studentId: string) {
    setStatuses(prev => {
      const cur = prev[studentId] ?? 'present'
      const next: AttendanceStatus = cur === 'present' ? 'absent' : cur === 'absent' ? 'late' : 'present'
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
      const absentCount = entries.filter(e => e.status !== 'present').length
      if (absentCount > 0) {
        const sendAt = new Date(Date.now() + 45 * 60 * 1000)
        const saat   = sendAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        setToast(`Kaydedildi. ${absentCount} öğrencinin velisine bildirim saat ${saat}'da gönderilecek.`)
      } else {
        setToast('Kaydedildi.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-4">
      {/* Sınıf + Tarih */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} className={inputCls}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Tarih</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Öğrenci Listesi */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400">Yükleniyor…</p>
        ) : students.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Bu sınıfta öğrenci yok.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">
            {students.map((s, i) => {
              const status = statuses[s.id] ?? 'present'
              return (
                <li key={s.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-800 dark:text-slate-100">
                    <span className="text-gray-400 dark:text-slate-500 mr-2 tabular-nums">{i + 1}.</span>
                    {s.full_name}
                    {s.student_number && <span className="ml-1.5 text-xs text-gray-400">#{s.student_number}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={`text-xs font-medium px-3 py-1 rounded-full ring-1 ring-inset transition-colors ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {toast && <p className="text-sm text-green-600 dark:text-green-400">{toast}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || loading || students.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
      >
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>

      <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
        Butona her tıklayınca: Mevcut → Devamsız → Geç → Mevcut
      </p>
    </div>
  )
}
