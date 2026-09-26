'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { format, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'
import type { OdevTamamlanmaItem } from '@/src/domains/dashboard/types'

/** Yazdırma raporuyla aynı renk dili: mavi yapıldı, sarı eksik, kırmızı yapılmadı */
const SERIT: { kod: SubmissionStatus; cls: string }[] = [
  { kod: 'yapildi',   cls: 'bg-blue-500' },
  { kod: 'gec',       cls: 'bg-orange-400' },
  { kod: 'eksik',     cls: 'bg-yellow-400' },
  { kod: 'yapilmadi', cls: 'bg-red-500' },
  { kod: 'mazeretli', cls: 'bg-gray-300 dark:bg-slate-500' },
]
const GOSTERILEN = 6

function TabButton({ id, label, selected, onSelect }: {
  id: string; label: string; selected: string; onSelect: (id: string) => void
}) {
  const active = selected === id
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-blue-400'
      }`}
    >
      {label}
    </button>
  )
}

function Satir({ o }: { o: OdevTamamlanmaItem }) {
  const yuzde = o.isaretli > 0 ? Math.round((o.sayim.yapildi / o.isaretli) * 100) : null
  return (
    <li>
      <Link href={`/odevler/${o.id}`} className="block px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{o.title}</span>
          {yuzde !== null && (
            <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-slate-200 shrink-0">%{yuzde}</span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          <span className="truncate">{o.className} · {format(parseISO(o.dueDate), 'd MMM')}</span>
          <span className="shrink-0 tabular-nums">
            {yuzde === null ? 'Henüz kontrol edilmedi' : <>
              {o.sayim.yapildi}/{o.isaretli} yaptı
              {o.sayim.yapilmadi > 0 && <span className="text-red-600 dark:text-red-400"> · {o.sayim.yapilmadi} yapmadı</span>}
            </>}
          </span>
        </div>
        {yuzde !== null && (
          <div className="flex h-1.5 mt-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700" aria-hidden>
            {SERIT.filter(s => o.sayim[s.kod] > 0).map(s => (
              <div key={s.kod} className={s.cls} style={{ width: `${(o.sayim[s.kod] / o.isaretli) * 100}%` }} />
            ))}
          </div>
        )}
      </Link>
    </li>
  )
}

export default function OdevTamamlanmaWidget({ data }: { data: OdevTamamlanmaItem[] }) {
  const [selectedClass, setSelectedClass] = useState('')

  const classes = useMemo(() => {
    const seen = new Map<string, string>()
    for (const d of data) if (!seen.has(d.classId)) seen.set(d.classId, d.className)
    return [...seen].map(([classId, className]) => ({ classId, className }))
      .sort((a, b) => a.className.localeCompare(b.className, 'tr', { numeric: true }))
  }, [data])

  // data en yeni teslim üstte gelir
  const liste = useMemo(
    () => (selectedClass === '' ? data : data.filter(d => d.classId === selectedClass)).slice(0, GOSTERILEN),
    [data, selectedClass],
  )

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden gap-0 pt-4 pb-0">
      <CardHeader className="px-4 pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">Ödev Tamamlanma</CardTitle>
        <p className="text-xs text-gray-500 dark:text-slate-400">Teslim tarihi geçen son ödevler</p>
      </CardHeader>

      {classes.length > 1 && (
        <div className="px-4 pb-2 flex gap-1 flex-wrap">
          <TabButton id="" label="Tümü" selected={selectedClass} onSelect={setSelectedClass} />
          {classes.map(c => (
            <TabButton key={c.classId} id={c.classId} label={c.className} selected={selectedClass} onSelect={setSelectedClass} />
          ))}
        </div>
      )}

      {liste.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">Teslim tarihi geçmiş ödev yok.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-700 border-t border-gray-100 dark:border-slate-700">
          {liste.map(o => <Satir key={o.id} o={o} />)}
        </ul>
      )}
    </Card>
  )
}
