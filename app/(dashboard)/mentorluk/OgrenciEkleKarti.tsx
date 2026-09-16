'use client'

import { useState, useTransition, useMemo } from 'react'
import { addMentorship } from '@/app/actions/mentor'

type Ogrenci = { id: string; full_name: string; class_name: string | null }

export default function OgrenciEkleKarti({ ogrenciler }: { ogrenciler: Ogrenci[] }) {
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sonuclar = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    if (!q) return ogrenciler.slice(0, 8)
    return ogrenciler.filter(o => o.full_name.toLocaleLowerCase('tr').includes(q)).slice(0, 8)
  }, [arama, ogrenciler])

  function ekle(id: string) {
    setHata(null)
    startTransition(async () => {
      const r = await addMentorship(id)
      if (r.error) setHata(r.error)
      else { setArama(''); setAcik(false) }
    })
  }

  if (!acik) {
    return (
      <button
        onClick={() => setAcik(true)}
        className="w-full min-h-[44px] rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-600 dark:text-slate-300 hover:border-gray-400 dark:hover:border-slate-500 transition-colors"
      >
        + Öğrenci ekle
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <input
        autoFocus
        value={arama}
        onChange={e => setArama(e.target.value)}
        placeholder="Öğrenci adı ara…"
        aria-label="Öğrenci ara"
        className="w-full min-h-[44px] text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-2">{hata}</p>}
      <ul className="mt-3 space-y-1">
        {sonuclar.map(o => (
          <li key={o.id}>
            <button
              onClick={() => ekle(o.id)}
              disabled={isPending}
              className="w-full flex items-center justify-between gap-2 min-h-[44px] px-3 rounded-xl text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <span className="text-gray-800 dark:text-slate-200 truncate">{o.full_name}</span>
              <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">{o.class_name ?? '—'}</span>
            </button>
          </li>
        ))}
        {sonuclar.length === 0 && (
          <li className="text-sm text-gray-500 dark:text-slate-400 px-3 py-2">Eşleşen öğrenci yok.</li>
        )}
      </ul>
      <button
        onClick={() => { setAcik(false); setArama(''); setHata(null) }}
        className="mt-2 min-h-[44px] px-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
      >
        Kapat
      </button>
    </div>
  )
}
