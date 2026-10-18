'use client'

import { useEffect, useState } from 'react'
import { varsayilanDers, type DersSecenekleri } from '@/src/domains/homework/dersSecimi'

const DUGME_SINIRI = 8 // daha çok seçenek (okulun tüm dersleri) açılır listeye döner

/** Ödev formunda ders: tek ders → kilitli etiket; birkaç ders → tek seçimli düğmeler (sınıf düğmeleri gibi).
 *  Seçilen sınıfta tek ders veriyorsa o seçili gelir; öğretmen elle seçtiyse sınıf değişince dokunulmaz.
 *  mevcutDers: düzenlenen ödevin dersi listede yoksa da seçenek olarak kalır (eski ödevler bozulmasın).
 *  onDegis: form göndermeyen yerler (hızlı ekleme çekmecesi) seçimi kendi state'inde tutsun. */
export default function DersSecici({ secenek, sinifId, baslangic = '', mevcutDers, selectClassName, onDegis }: {
  secenek: DersSecenekleri
  sinifId: string | null
  baslangic?: string
  mevcutDers?: string
  selectClassName: string
  onDegis?: (ders: string) => void
}) {
  const secenekler = mevcutDers && !secenek.dersler.includes(mevcutDers) ? [...secenek.dersler, mevcutDers] : secenek.dersler
  const [secili, setSecili] = useState(() => (secenekler.includes(baslangic) ? baslangic : varsayilanDers(secenek, sinifId)))
  const [elle, setElle] = useState(secenekler.includes(baslangic))

  useEffect(() => {
    if (elle) return
    const v = varsayilanDers(secenek, sinifId)
    if (v) setSecili(v)
  }, [sinifId, elle, secenek])

  const gecerli = secenekler.length === 1 ? secenekler[0] : secili
  useEffect(() => { onDegis?.(gecerli) }, [gecerli, onDegis])

  if (secenekler.length === 1) {
    return (
      <>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600">
          {secenekler[0]}
        </span>
        <input type="hidden" name="subject" value={secenekler[0]} />
      </>
    )
  }

  if (secenekler.length > DUGME_SINIRI) {
    return (
      <select name="subject" required aria-label="Ders" className={selectClassName} value={secili}
        onChange={e => { setSecili(e.target.value); setElle(true) }}>
        <option value="">Ders seçin</option>
        {secenekler.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    )
  }

  return (
    <>
      <div role="group" aria-label="Ders" className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
        {secenekler.map(d => {
          const sec = d === secili
          return (
            <button key={d} type="button" aria-pressed={sec}
              onClick={() => { setSecili(d); setElle(true) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all duration-150 ${
                sec
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700'
              }`}>
              {d}
            </button>
          )
        })}
      </div>
      <input type="hidden" name="subject" value={secili} />
      {!secili && <p className="text-xs text-gray-500 dark:text-slate-400 pt-0.5">Bir ders seçin.</p>}
    </>
  )
}
