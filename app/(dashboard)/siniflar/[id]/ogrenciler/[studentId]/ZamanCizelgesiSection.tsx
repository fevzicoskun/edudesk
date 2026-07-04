'use client'

import { useState } from 'react'
import { format, parseISO } from '@/src/shared/date'
import type { TimelineEvent, TimelineKind } from '@/src/domains/classes/lib/timelineMath'

const GORUNUR_SAYI = 30

const KIND_DOT: Record<TimelineKind, string> = {
  devamsizlik:   'bg-red-500',
  odev:          'bg-orange-500',
  not:           'bg-blue-500',
  gorusme:       'bg-emerald-500',
  rehberlik:     'bg-purple-500',
  veli_iletisim: 'bg-teal-500',
  ogretmen_notu: 'bg-gray-400 dark:bg-slate-500',
}

// Öğrenci 360: dönem başından bugüne kayda değer olayların kronolojik akışı.
export default function ZamanCizelgesiSection({ events }: { events: TimelineEvent[] }) {
  const [showAll, setShowAll] = useState(false)
  if (events.length === 0) return null
  const visible = showAll ? events : events.slice(0, GORUNUR_SAYI)

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
        Zaman Çizelgesi
        <span className="font-normal text-gray-500 dark:text-slate-400"> · dönem başından bugüne</span>
      </h2>
      <ol className="space-y-2">
        {visible.map((e, i) => (
          <li key={`${e.date}-${e.kind}-${i}`} className="flex items-start gap-3">
            <span aria-hidden className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${KIND_DOT[e.kind]}`} />
            <span className="text-xs text-gray-500 dark:text-slate-400 w-24 shrink-0 mt-0.5">
              {format(parseISO(e.date), 'd MMM yyyy')}
            </span>
            <span className="text-sm text-gray-800 dark:text-slate-200">{e.label}</span>
          </li>
        ))}
      </ol>
      {events.length > GORUNUR_SAYI && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Tümünü göster ({events.length})
        </button>
      )}
    </section>
  )
}
