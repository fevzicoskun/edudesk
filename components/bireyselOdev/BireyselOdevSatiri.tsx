'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { bireyselOdevYapildi, bireyselOdevDuzenle, bireyselOdevSil } from '@/app/actions/bireysel-odev'
import { gecikmisMi, type BireyselOdev } from '@/src/domains/bireyselOdev/lib/liste'

// Telefonda rahat dokunma: en az 44px yükseklik (spec 2026-10-24)
const dugme = 'min-h-11 px-3 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60'
const kutu = 'w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100'
export const gunYaz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
const verilisYaz = (ts: string) => new Date(ts).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' })

/** Tek bireysel ödev: durum, tek tık yapıldı/geri al, düzenle, iki adımlı sil. ogrenciBaglantisi → liste ekranı (öğrenci adı + sınıf). */
export default function BireyselOdevSatiri({ odev: o, bugun, ogrenciBaglantisi = false }: { odev: BireyselOdev; bugun: string; ogrenciBaglantisi?: boolean }) {
  const [duzen, setDuzen] = useState(false)
  const [silOnay, setSilOnay] = useState(false)
  const [aciklama, setAciklama] = useState(o.aciklama)
  const [teslim, setTeslim] = useState(o.teslimTarihi ?? '')
  const [hata, setHata] = useState('')
  const [bekliyor, basla] = useTransition()
  const gecikmis = gecikmisMi(o, bugun)
  const yap = (is: () => Promise<{ error?: string }>, sonra?: () => void) => basla(async () => {
    setHata('')
    const r = await is()
    if (r.error) setHata(r.error)
    else sonra?.()
  })

  return (
    <li aria-label={o.aciklama} className={`border rounded-xl p-3 ${gecikmis ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : 'border-gray-200 dark:border-slate-700'}`}>
      {duzen ? (
        <form onSubmit={e => { e.preventDefault(); yap(() => bireyselOdevDuzenle({ id: o.id, aciklama, teslimTarihi: teslim }), () => setDuzen(false)) }} className="space-y-2">
          <label className="block text-sm text-gray-700 dark:text-slate-300">Açıklama
            <input value={aciklama} onChange={e => setAciklama(e.target.value)} required maxLength={300} className={kutu} />
          </label>
          <label className="block text-sm text-gray-700 dark:text-slate-300">Teslim tarihi (isteğe bağlı)
            <input type="date" value={teslim} onChange={e => setTeslim(e.target.value)} className={kutu} />
          </label>
          <div className="flex gap-2">
            <button disabled={bekliyor} className={`${dugme} bg-blue-600 border-blue-600 text-white hover:bg-blue-700`}>Kaydet</button>
            <button type="button" onClick={() => { setDuzen(false); setAciklama(o.aciklama); setTeslim(o.teslimTarihi ?? '') }}
              className={`${dugme} border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200`}>Vazgeç</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            {ogrenciBaglantisi && (
              <Link href={`/siniflar/${o.sinifId}/ogrenciler/${o.ogrenciId}`} className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline">
                {o.ogrenciAd} <span className="font-normal text-gray-500 dark:text-slate-400">· {o.sinifAd}</span>
              </Link>
            )}
            <p className={`text-base break-words ${o.yapildi ? 'line-through text-gray-500 dark:text-slate-400' : 'text-gray-900 dark:text-slate-100'}`}>{o.aciklama}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Verildi {verilisYaz(o.olusturmaTarihi)}
              {o.teslimTarihi && <> · <span className={gecikmis ? 'text-red-700 dark:text-red-300 font-semibold' : ''}>Teslim {gunYaz(o.teslimTarihi)}</span></>}
              {' · '}<span className={o.yapildi ? 'text-green-700 dark:text-green-300 font-semibold' : gecikmis ? 'text-red-700 dark:text-red-300 font-semibold' : ''}>
                {o.yapildi ? 'Yapıldı' : gecikmis ? 'Gecikti' : 'Bekliyor'}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button type="button" disabled={bekliyor} aria-pressed={o.yapildi} onClick={() => yap(() => bireyselOdevYapildi(o.id, !o.yapildi))}
              className={`${dugme} ${o.yapildi ? 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200' : 'bg-green-600 border-green-600 text-white hover:bg-green-700'}`}>
              {o.yapildi ? 'Geri al' : 'Yapıldı'}
            </button>
            <button type="button" onClick={() => setDuzen(true)} className={`${dugme} border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200`}>Düzenle</button>
            {silOnay ? <>
              <button type="button" disabled={bekliyor} onClick={() => yap(() => bireyselOdevSil(o.id))} className={`${dugme} bg-red-600 border-red-600 text-white hover:bg-red-700`}>Emin misin? Sil</button>
              <button type="button" onClick={() => setSilOnay(false)} className={`${dugme} border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200`}>Vazgeç</button>
            </> : (
              <button type="button" onClick={() => setSilOnay(true)} className={`${dugme} border-gray-300 dark:border-slate-600 text-red-700 dark:text-red-300`}>Sil</button>
            )}
          </div>
        </div>
      )}
      {hata && <p role="alert" className="text-sm text-red-700 dark:text-red-300 mt-2">{hata}</p>}
    </li>
  )
}
