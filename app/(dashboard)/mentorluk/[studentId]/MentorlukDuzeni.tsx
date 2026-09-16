'use client'

import { useState, useTransition } from 'react'
import { markRulesExplained } from '@/app/actions/mentor'
import { MENTORSHIP_RULES } from '@/src/domains/mentor/mentorshipRules'
import { format, parseISO } from '@/src/shared/date'

export default function MentorlukDuzeni({
  studentId, anlatildiTarihi,
}: { studentId: string; anlatildiTarihi: string | null }) {
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function isaretle() {
    setHata(null)
    startTransition(async () => {
      const r = await markRulesExplained(studentId)
      if (r.error) setHata(r.error)
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Mentörlük düzenimiz</h2>
      <ul className="space-y-2 mb-4">
        {MENTORSHIP_RULES.map(madde => (
          <li key={madde} className="flex gap-2 text-sm text-gray-700 dark:text-slate-300">
            <span aria-hidden="true" className="text-gray-400 dark:text-slate-500">•</span>
            <span>{madde}</span>
          </li>
        ))}
      </ul>

      {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-2">{hata}</p>}

      {anlatildiTarihi ? (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          ✓ Öğrenciye anlatıldı — {format(parseISO(anlatildiTarihi), 'd MMMM yyyy')}
        </p>
      ) : (
        <button
          onClick={isaretle}
          disabled={isPending}
          className="min-h-[44px] px-4 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Kaydediliyor…' : 'Öğrenciye anlattım olarak işaretle'}
        </button>
      )}
    </section>
  )
}
