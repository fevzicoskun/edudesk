'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSchedule } from '@/app/actions/schedules'

type Teacher = { id: string; full_name: string | null; subject: string | null }
type Cls = { id: string; name: string; grade: number }

export default function YeniProgramForm({
  teachers,
  classes,
  okulLabel,
}: {
  teachers: Teacher[]
  classes: Cls[]
  okulLabel: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [scheduleType, setScheduleType] = useState<'resmi' | 'okul'>('resmi')
  const [targetType, setTargetType] = useState<'ogretmen' | 'sinif'>('ogretmen')
  const [teacherId, setTeacherId] = useState('')
  const [classId, setClassId] = useState('')
  const [periodCount, setPeriodCount] = useState(8)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (targetType === 'ogretmen' && !teacherId) { setError('Öğretmen seçiniz.'); return }
    if (targetType === 'sinif' && !classId) { setError('Sınıf seçiniz.'); return }

    startTransition(async () => {
      try {
        const id = await createSchedule({
          schedule_type: scheduleType,
          type_label: scheduleType === 'resmi' ? 'Resmi Ders Programı' : okulLabel,
          teacher_id: targetType === 'ogretmen' ? teacherId : null,
          class_id: targetType === 'sinif' ? classId : null,
          period_count: periodCount,
        })
        router.push(`/ders-programi/${id}`)
      } catch {
        setError('Bir hata oluştu, tekrar deneyin.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      {/* Program türü */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Program Türü</legend>
        <div className="grid grid-cols-2 gap-3">
          {(['resmi', 'okul'] as const).map(t => (
            <label
              key={t}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                scheduleType === t
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="scheduleType"
                value={t}
                checked={scheduleType === t}
                onChange={() => setScheduleType(t)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                scheduleType === t ? 'border-blue-500' : 'border-gray-300 dark:border-slate-500'
              }`}>
                {scheduleType === t && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {t === 'resmi' ? 'Resmi Ders Programı' : okulLabel}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Hedef türü */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Program Kime Ait?</legend>
        <div className="grid grid-cols-2 gap-3">
          {(['ogretmen', 'sinif'] as const).map(t => (
            <label
              key={t}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                targetType === t
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="targetType"
                value={t}
                checked={targetType === t}
                onChange={() => setTargetType(t)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                targetType === t ? 'border-blue-500' : 'border-gray-300 dark:border-slate-500'
              }`}>
                {targetType === t && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {t === 'ogretmen' ? 'Öğretmen Bazında' : 'Sınıf Bazında'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Target selector */}
      {targetType === 'ogretmen' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Öğretmen Seçin</label>
          <select
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">— Öğretmen seçin —</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>
                {t.full_name ?? t.id}{t.subject ? ` — ${t.subject}` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Sınıf Seçin</label>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">— Sınıf seçin —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.grade}. Sınıf — {c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Period count */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          Günlük Ders Saati Sayısı
        </label>
        <input
          type="number"
          min={4}
          max={12}
          value={periodCount}
          onChange={e => setPeriodCount(Number(e.target.value))}
          className="w-24 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {pending ? 'Oluşturuluyor...' : 'Oluştur ve Düzenle →'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          Geri
        </button>
      </div>
    </form>
  )
}
