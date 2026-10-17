'use client'
import { useState, useTransition } from 'react'
import { kitapHerkeseEkle } from '@/app/actions/mentor-takip'
import { DERS_ONERILERI } from '@/src/domains/mentor/takip/sablonlar'

const kutu = 'block rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'

/** Aynı kitabı tüm mentör öğrencilerine tanımlar; zaten olanlar atlanır. */
export default function KitapHerkeseFormu() {
  const [ad, setAd] = useState(''); const [ders, setDers] = useState('')
  const [mesaj, setMesaj] = useState<{ hata: boolean; metin: string } | null>(null)
  const [bekliyor, basla] = useTransition()
  return (
    <details className="mb-4 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2">
      <summary className="text-sm font-medium cursor-pointer">Kitap ekle (tüm mentör öğrencilerime)</summary>
      <form aria-label="Tüm mentör öğrencilerime kitap ekle" className="mt-2 flex flex-wrap gap-2 items-end" onSubmit={e => {
        e.preventDefault()
        basla(async () => {
          const r = await kitapHerkeseEkle(ad, ders)
          if (r.error) { setMesaj({ hata: true, metin: r.error }); return }
          setMesaj({ hata: false, metin: `${r.eklenen} öğrenciye eklendi${r.atlanan ? `; ${r.atlanan} öğrencide zaten vardı` : ''}.` })
          setAd(''); setDers('')
        })
      }}>
        <label className="text-sm">Kitap adı<input maxLength={120} className={`${kutu} w-56`} value={ad} onChange={e => setAd(e.target.value)} required /></label>
        <label className="text-sm">Ders<input maxLength={60} list="herkese-dersler" className={`${kutu} w-40`} value={ders} onChange={e => setDers(e.target.value)} /></label>
        <datalist id="herkese-dersler">{DERS_ONERILERI.map(x => <option key={x} value={x} />)}</datalist>
        <button disabled={bekliyor} className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm">{bekliyor ? 'Ekleniyor…' : 'Hepsine ekle'}</button>
        {mesaj && <span role={mesaj.hata ? 'alert' : 'status'} className={`text-sm ${mesaj.hata ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{mesaj.metin}</span>}
      </form>
    </details>
  )
}
