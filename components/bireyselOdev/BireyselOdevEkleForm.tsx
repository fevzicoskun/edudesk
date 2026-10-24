'use client'
import { useState, useTransition } from 'react'
import { bireyselOdevEkle } from '@/app/actions/bireysel-odev'

const kutu = 'w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100'
const dugme = 'min-h-11 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-60'

/** "Bireysel ödev ekle": yalnız açıklama + isteğe bağlı teslim tarihi (giriş 10 saniyede bitmeli — spec 2026-10-24). */
export default function BireyselOdevEkleForm({ ogrenciId }: { ogrenciId: string }) {
  const [acik, setAcik] = useState(false)
  const [aciklama, setAciklama] = useState('')
  const [teslim, setTeslim] = useState('')
  const [hata, setHata] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [bekliyor, basla] = useTransition()

  const kaydet = () => basla(async () => {
    setHata(''); setMesaj('')
    const r = await bireyselOdevEkle({ ogrenciId, aciklama, teslimTarihi: teslim })
    if (r.error) { setHata(r.error); return }
    setAciklama(''); setTeslim(''); setAcik(false); setMesaj('Bireysel ödev eklendi.')
  })

  if (!acik) return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => { setAcik(true); setMesaj('') }} className={`${dugme} bg-blue-600 text-white hover:bg-blue-700`}>+ Bireysel ödev ekle</button>
      {mesaj && <p role="status" className="text-sm text-green-700 dark:text-green-300">{mesaj}</p>}
    </div>
  )
  return (
    <form aria-label="Bireysel ödev ekle" onSubmit={e => { e.preventDefault(); kaydet() }} className="space-y-2 border border-gray-200 dark:border-slate-700 rounded-xl p-3">
      <label className="block text-sm text-gray-700 dark:text-slate-300">Açıklama
        <input autoFocus value={aciklama} onChange={e => setAciklama(e.target.value)} required maxLength={300}
          placeholder="Örn. Türev testi, s. 45–52" className={kutu} />
      </label>
      <label className="block text-sm text-gray-700 dark:text-slate-300">Teslim tarihi (isteğe bağlı)
        <input type="date" value={teslim} onChange={e => setTeslim(e.target.value)} className={kutu} />
      </label>
      {hata && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{hata}</p>}
      <div className="flex gap-2">
        <button disabled={bekliyor} className={`${dugme} bg-blue-600 text-white hover:bg-blue-700`}>{bekliyor ? 'Kaydediliyor…' : 'Kaydet'}</button>
        <button type="button" onClick={() => { setAcik(false); setHata('') }} className={`${dugme} border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200`}>Vazgeç</button>
      </div>
    </form>
  )
}
