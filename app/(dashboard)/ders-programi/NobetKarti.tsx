'use client'

import { useState, useTransition } from 'react'
import { addDuty, deleteDuty } from '@/app/actions/duty'
import { useToast } from '@/components/Toast'
import type { Duty } from '@/src/domains/schedule/services/DutyService'

const DAYS = [
  { n: 1, label: 'Pazartesi' },
  { n: 2, label: 'Salı' },
  { n: 3, label: 'Çarşamba' },
  { n: 4, label: 'Perşembe' },
  { n: 5, label: 'Cuma' },
]
const DAY_LABEL: Record<number, string> = Object.fromEntries(DAYS.map(d => [d.n, d.label]))

const MAX_NOTES = 200

export default function NobetKarti({ initialDuties }: { initialDuties: Duty[] }) {
  const { toast } = useToast()
  const [duties, setDuties] = useState<Duty[]>(initialDuties)
  // Yeni nöbet formu
  const [day, setDay] = useState<number>(1)
  const [timeRange, setTimeRange] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function add() {
    // İstemci tarafı erken doğrulama — sunucu yine de doğruluyor (tek gerçek otorite).
    if (!timeRange.trim() || !location.trim()) {
      toast('Saat aralığı ve nöbet yeri zorunludur', 'error')
      return
    }
    startTransition(async () => {
      const res = await addDuty({
        day_of_week: day,
        time_range: timeRange,
        location,
        notes: notes.trim() ? notes : null,
      })
      if (res.error || !res.duty) {
        toast(res.error ?? 'Nöbet eklenemedi', 'error')
        return
      }
      // Sunucudan dönen gerçek id'li nöbeti ekle, gün sırasını koru (server order'ını taklit et).
      setDuties(prev => [...prev, res.duty!].sort((a, b) => a.day_of_week - b.day_of_week))
      setTimeRange('')
      setLocation('')
      setNotes('')
      toast('Nöbet eklendi', 'success')
    })
  }

  function remove(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const res = await deleteDuty(id)
      setDeletingId(null)
      if (res.error) {
        toast(res.error, 'error')
        return
      }
      setDuties(prev => prev.filter(d => d.id !== id))
      toast('Nöbet silindi', 'success')
    })
  }

  return (
    <section className="mt-8 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Nöbet Bilgilerim</h2>

      {/* Mevcut nöbetler */}
      {duties.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Henüz nöbet eklemediniz. Birden fazla nöbet ekleyebilirsiniz.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {duties.map(d => (
            <li
              key={d.id}
              className="flex items-center gap-2 flex-wrap rounded-lg border border-gray-100 dark:border-slate-800 px-3 py-2"
            >
              <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{DAY_LABEL[d.day_of_week] ?? '—'}</span>
              <span className="text-sm text-gray-500 dark:text-slate-400">{d.time_range} · {d.location}</span>
              {d.notes && <span className="text-xs text-gray-400 dark:text-slate-500">({d.notes})</span>}
              <button
                onClick={() => remove(d.id)}
                disabled={pending && deletingId === d.id}
                aria-label={`${DAY_LABEL[d.day_of_week] ?? ''} nöbetini sil`}
                className="ml-auto text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg px-3 py-2 -my-1 disabled:opacity-50"
              >
                {pending && deletingId === d.id ? 'Siliniyor…' : 'Sil'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Yeni nöbet ekle */}
      <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Yeni nöbet ekle</p>
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
            onClick={add}
            disabled={pending}
            className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? 'Ekleniyor…' : 'Nöbet Ekle'}
          </button>
        </div>
      </div>
    </section>
  )
}
