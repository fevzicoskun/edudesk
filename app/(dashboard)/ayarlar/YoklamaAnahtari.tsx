'use client'
import { useState, useTransition } from 'react'
import { setYoklamaAktif } from '@/app/actions/school'

/** Okul ayarları: yoklama modülü aç/kapat (yalnız müdür/MY'ye gösterilir; sunucu ayrıca doğrular). */
export default function YoklamaAnahtari({ initial }: { initial: boolean }) {
  const [acik, setAcik] = useState(initial)
  const [hata, setHata] = useState('')
  const [bekliyor, basla] = useTransition()

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Okul ayarları</h2>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="yoklama-modulu-etiket" className="text-sm font-medium text-gray-800 dark:text-slate-200">Yoklama modülü</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Kapalıyken yoklama ve devamsızlık bölümleri, menüleri ve bildirimleri tüm okulda gizlenir. Kayıtlı veriler silinmez; açınca geri gelir.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={acik}
          aria-labelledby="yoklama-modulu-etiket"
          disabled={bekliyor}
          onClick={() => {
            const yeni = !acik
            setHata('')
            setAcik(yeni)
            basla(async () => {
              const r = await setYoklamaAktif(yeni)
              if (r.error) { setAcik(!yeni); setHata(r.error) }
            })
          }}
          className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60 ${acik ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${acik ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <p className="text-xs mt-2 text-gray-500 dark:text-slate-400" aria-live="polite">{acik ? 'Açık' : 'Kapalı'}</p>
      {hata && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-1">{hata}</p>}
    </section>
  )
}
