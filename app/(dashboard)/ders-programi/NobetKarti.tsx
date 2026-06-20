'use client'

import { useState, useTransition } from 'react'
import { saveDuty } from '@/app/actions/duty'
import { useToast } from '@/components/Toast'
import type { Duty } from '@/src/domains/schedule/services/DutyService'

const DAYS = [
  { n: 1, label: 'Pazartesi' },
  { n: 2, label: 'Salı' },
  { n: 3, label: 'Çarşamba' },
  { n: 4, label: 'Perşembe' },
  { n: 5, label: 'Cuma' },
]

const MAX_NOTES = 200

export default function NobetKarti({ initialDuty }: { initialDuty: Duty | null }) {
  const { toast } = useToast()
  const [day, setDay] = useState<number>(initialDuty?.day_of_week ?? 1)
  const [timeRange, setTimeRange] = useState<string>(initialDuty?.time_range ?? '')
  const [location, setLocation] = useState<string>(initialDuty?.location ?? '')
  const [notes, setNotes] = useState<string>(initialDuty?.notes ?? '')
  const [pending, startTransition] = useTransition()

  function save() {
    // İstemci tarafı erken doğrulama — sunucu yine de doğruluyor (tek gerçek otorite).
    if (!timeRange.trim() || !location.trim()) {
      toast('Saat aralığı ve nöbet yeri zorunludur', 'error')
      return
    }
    startTransition(async () => {
      const res = await saveDuty({
        day_of_week: day,
        time_range: timeRange,
        location,
        notes: notes.trim() ? notes : null,
      })
      toast(res.error ?? 'Nöbet bilgileriniz kaydedildi', res.error ? 'error' : 'success')
    })
  }

  return (
    <section className="mt-8 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Nöbet Bilgilerim</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-600 dark:text-slate-300">
          Nöbet günü
          <select
            value={day}
            onChange={e => setDay(Number(e.target.value))}
            className="mt-1 w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
          >
            {DAYS.map(d => (
              <option key={d.n} value={d.n}>{d.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-gray-600 dark:text-slate-300">
          Saat / Aralık
          <input
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            maxLength={40}
            placeholder="08:00–08:40"
            className="mt-1 w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
          />
        </label>

        <label className="text-sm text-gray-600 dark:text-slate-300">
          Yer / Konum
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            maxLength={100}
            placeholder="Zemin kat koridoru"
            className="mt-1 w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
          />
        </label>
      </div>

      <label className="mt-3 block text-sm text-gray-600 dark:text-slate-300">
        Ek notlar (opsiyonel)
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value.slice(0, MAX_NOTES))}
          maxLength={MAX_NOTES}
          rows={2}
          className="mt-1 w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
        />
        <span className="text-xs text-gray-400 dark:text-slate-500">{notes.length}/{MAX_NOTES}</span>
      </label>

      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Kaydediliyor…' : 'Nöbeti Kaydet'}
        </button>
      </div>
    </section>
  )
}
