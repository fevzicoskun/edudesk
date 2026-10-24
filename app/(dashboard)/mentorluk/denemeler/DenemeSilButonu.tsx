'use client'
import { useState, useTransition } from 'react'
import { denemeSil } from '@/app/actions/deneme'

/** İki adımlı silme (confirm() tarayıcı otomasyonunu kilitliyor): "Sil" → "Emin misin? Sil". */
export default function DenemeSilButonu({ sinavId, sinifId }: { sinavId: string; sinifId: string }) {
  const [onay, setOnay] = useState(false)
  const [hata, setHata] = useState('')
  const [bekliyor, basla] = useTransition()
  const sil = () => basla(async () => {
    const r = await denemeSil(sinavId, sinifId)
    if (r.error) { setHata(r.error); setOnay(false) }
  })
  return (
    <span className="flex items-center gap-2 shrink-0">
      {hata && <span role="alert" className="text-xs text-red-700 dark:text-red-300">{hata}</span>}
      {onay ? <>
        <button type="button" onClick={sil} disabled={bekliyor}
          className="px-2 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">Emin misin? Sil</button>
        <button type="button" onClick={() => setOnay(false)} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600">Vazgeç</button>
      </> : (
        <button type="button" onClick={() => setOnay(true)}
          className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">Sil</button>
      )}
    </span>
  )
}
