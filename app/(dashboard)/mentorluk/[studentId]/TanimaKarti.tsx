'use client'

import { useState, useTransition } from 'react'
import { saveMentorProfile } from '@/app/actions/mentor'

type Profil = {
  goals_short: string | null
  goals_long: string | null
  interests: string | null
  family_info: string | null
  study_environment: string | null
  special_note: string | null
  support_request: string | null
} | null

const ALANLAR = [
  { ad: 'goals_short',       etiket: 'Kısa vadeli hedefleri' },
  { ad: 'goals_long',        etiket: 'Uzun vadeli hedefleri' },
  { ad: 'interests',         etiket: 'Hobi, spor, sanat, ilgi alanları' },
  { ad: 'family_info',       etiket: 'Aile durumu, anne-baba iş, kardeşler' },
  { ad: 'study_environment', etiket: 'Ders çalışma ortamı' },
  { ad: 'special_note',      etiket: 'Aktarmak istediği özel bir durum' },
  { ad: 'support_request',   etiket: 'İstediği destek / özel isteği' },
] as const

export default function TanimaKarti({ studentId, profil }: { studentId: string; profil: Profil }) {
  const [duzenle, setDuzenle] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function kaydet(formData: FormData) {
    setHata(null)
    startTransition(async () => {
      const r = await saveMentorProfile(studentId, formData)
      if (r.error) setHata(r.error)
      else setDuzenle(false)
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100">Tanıma kartı</h2>
        {!duzenle && (
          <button
            onClick={() => setDuzenle(true)}
            className="inline-flex items-center min-h-[44px] px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Düzenle
          </button>
        )}
      </div>

      {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-3">{hata}</p>}

      {duzenle ? (
        <form action={kaydet} className="space-y-4">
          {ALANLAR.map(a => (
            <div key={a.ad}>
              <label htmlFor={a.ad} className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                {a.etiket}
              </label>
              <textarea
                id={a.ad}
                name={a.ad}
                rows={2}
                maxLength={2000}
                defaultValue={profil?.[a.ad] ?? ''}
                className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => { setDuzenle(false); setHata(null) }}
              className="min-h-[44px] px-4 rounded-xl text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              Vazgeç
            </button>
          </div>
        </form>
      ) : (
        <dl className="space-y-3">
          {ALANLAR.map(a => (
            <div key={a.ad}>
              <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">{a.etiket}</dt>
              <dd className="text-sm text-gray-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">
                {profil?.[a.ad] || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
