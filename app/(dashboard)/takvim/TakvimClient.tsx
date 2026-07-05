'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createSchoolEvent, deleteSchoolEvent } from '@/app/actions/calendar'
import type { CalendarEvent, MonthCell } from '@/src/domains/calendar/calendarMath'

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUN_BASLIKLARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

// Kategori işaret renkleri (dataviz uyumlu, açık/koyu temada okunur).
const TYPE_STYLE: Record<CalendarEvent['type'], { dot: string; label: string }> = {
  tatil:    { dot: 'bg-rose-500',    label: 'Tatil' },
  etkinlik: { dot: 'bg-violet-500',  label: 'Etkinlik' },
  nobet:    { dot: 'bg-amber-500',   label: 'Nöbet' },
  randevu:  { dot: 'bg-sky-500',     label: 'Veli randevusu' },
  odev:     { dot: 'bg-emerald-500', label: 'Ödev teslimi' },
}

interface Props {
  year: number
  month: number
  cells: MonthCell[]
  days: Record<string, CalendarEvent[]>
  canManage: boolean
  todayStr: string
  prevHref: string
  nextHref: string
}

function formatTR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${AY_ADLARI[m - 1]} ${y}`
}

export default function TakvimClient({ year, month, cells, days, canManage, todayStr, prevHref, nextHref }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selectedEvents = selected ? (days[selected] ?? []) : []
  const eventDates = Object.keys(days).sort()

  function submitEvent(formData: FormData) {
    setFormError(null)
    startTransition(async () => {
      const result = await createSchoolEvent({
        title: String(formData.get('title') ?? ''),
        eventDate: String(formData.get('eventDate') ?? ''),
        note: String(formData.get('note') ?? '') || null,
      })
      if (result.error) { setFormError(result.error); return }
      setModalOpen(false)
    })
  }

  function removeEvent(id: string) {
    startTransition(async () => { await deleteSchoolEvent(id) })
  }

  return (
    <div>
      {/* Başlık + ay gezinme */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Takvim</h1>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            + Etkinlik
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Link href={prevHref} aria-label="Önceki ay" className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">‹</Link>
        <span className="font-semibold min-w-36 text-center">{AY_ADLARI[month - 1]} {year}</span>
        <Link href={nextHref} aria-label="Sonraki ay" className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">›</Link>
      </div>

      {/* Kategori lejantı */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-xs text-gray-500 dark:text-slate-400">
        {Object.entries(TYPE_STYLE).map(([type, s]) => (
          <span key={type} className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      {/* Masaüstü: ay ızgarası */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
          {GUN_BASLIKLARI.map(g => <div key={g} className="px-2 py-1">{g}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map(cell => {
            const events = days[cell.date] ?? []
            const isTatil = events.some(e => e.type === 'tatil')
            const isToday = cell.date === todayStr
            return (
              <button
                key={cell.date}
                onClick={() => setSelected(cell.date === selected ? null : cell.date)}
                disabled={!cell.inMonth}
                aria-label={`${formatTR(cell.date)}${events.length ? `, ${events.length} olay` : ''}`}
                className={[
                  'min-h-20 p-1.5 rounded-lg border text-left align-top transition-colors',
                  cell.inMonth
                    ? 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    : 'border-transparent opacity-40',
                  isTatil && cell.inMonth ? 'bg-rose-50 dark:bg-rose-950/30' : '',
                  selected === cell.date ? 'ring-2 ring-blue-500' : '',
                ].join(' ')}
              >
                <span className={`text-sm ${isToday ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>{cell.day}</span>
                <span className="flex flex-wrap gap-0.5 mt-1">
                  {events.slice(0, 4).map((e, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${TYPE_STYLE[e.type].dot}`} aria-hidden />
                  ))}
                  {events.length > 4 && <span className="text-[10px] text-gray-500 dark:text-slate-400">+{events.length - 4}</span>}
                </span>
              </button>
            )
          })}
        </div>

        {/* Gün detay paneli */}
        {selected && (
          <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
            <h2 className="font-semibold mb-2">{formatTR(selected)}</h2>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Bu günde olay yok.</p>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TYPE_STYLE[e.type].dot}`} aria-hidden />
                    <span className="flex-1">
                      <span className="font-medium">{e.title}</span>
                      {e.detail && <span className="text-gray-500 dark:text-slate-400"> · {e.detail}</span>}
                    </span>
                    {canManage && e.type === 'etkinlik' && e.id && (
                      <button
                        onClick={() => removeEvent(e.id!)}
                        disabled={pending}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        Sil
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Mobil: ajanda listesi */}
      <div className="md:hidden">
        {eventDates.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">
            Bu ayda takvimde olay yok.
          </p>
        ) : (
          <ul className="space-y-4">
            {eventDates.map(date => (
              <li key={date}>
                <h3 className={`text-sm font-semibold mb-1 ${date === todayStr ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  {formatTR(date)}
                </h3>
                <ul className="space-y-1.5">
                  {days[date].map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TYPE_STYLE[e.type].dot}`} aria-hidden />
                      <span className="flex-1">
                        <span className="font-medium">{e.title}</span>
                        {e.detail && <span className="text-gray-500 dark:text-slate-400"> · {e.detail}</span>}
                      </span>
                      {canManage && e.type === 'etkinlik' && e.id && (
                        <button onClick={() => removeEvent(e.id!)} disabled={pending} className="text-xs text-rose-600 dark:text-rose-400">Sil</button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Masaüstü boş durum (ızgara altında, olaysız ay) */}
      {eventDates.length === 0 && (
        <p className="hidden md:block text-sm text-gray-500 dark:text-slate-400 mt-4 text-center">
          Bu ayda takvimde olay yok.{canManage ? ' "+ Etkinlik" ile ekleyebilirsin.' : ''}
        </p>
      )}

      {/* Yeni etkinlik modalı */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-5">
            <h2 className="text-lg font-semibold mb-4">Yeni Etkinlik</h2>
            <form action={submitEvent} className="space-y-3">
              <div>
                <label htmlFor="ev-title" className="block text-sm font-medium mb-1">Başlık</label>
                <input id="ev-title" name="title" required maxLength={200}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ev-date" className="block text-sm font-medium mb-1">Tarih</label>
                <input id="ev-date" name="eventDate" type="date" required
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ev-note" className="block text-sm font-medium mb-1">Not (isteğe bağlı)</label>
                <textarea id="ev-note" name="note" rows={2} maxLength={1000}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
              </div>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-slate-600">Vazgeç</button>
                <button type="submit" disabled={pending}
                  className="px-3 py-2 rounded-lg text-sm bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                  {pending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
