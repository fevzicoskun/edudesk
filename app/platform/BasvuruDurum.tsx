'use client'

import { useState, useTransition } from 'react'
import { updateBasvuruDurum } from './actions'

const DURUMLAR = [
  ['yeni', 'Yeni'], ['arandi', 'Arandı'], ['demo', 'Demo yapıldı'], ['kazanildi', 'Kazanıldı'], ['kaybedildi', 'Kaybedildi'],
] as const

export default function BasvuruDurum({ id, durum }: { id: string; durum: string }) {
  const [deger, setDeger] = useState(durum)
  const [hata, setHata] = useState('')
  const [isPending, startTransition] = useTransition()
  return (
    <div className="flex flex-col items-end gap-1">
      <select aria-label="Başvuru durumu" value={deger} disabled={isPending}
        onChange={e => {
          const yeni = e.target.value, eski = deger
          setDeger(yeni)
          startTransition(async () => {
            const r = await updateBasvuruDurum(id, yeni)
            if (r.error) { setDeger(eski); setHata(r.error) } else setHata('')
          })
        }}
        className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-2 py-1">
        {DURUMLAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {hata && <span role="alert" className="text-xs text-red-400">{hata}</span>}
    </div>
  )
}
