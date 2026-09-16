'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeMentorship } from '@/app/actions/mentor'

export default function ListedenCikarButonu({ studentId, ad }: { studentId: string; ad: string }) {
  const [onay, setOnay] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function cikar() {
    setHata(null)
    startTransition(async () => {
      const r = await removeMentorship(studentId)
      if (r.error) { setHata(r.error); setOnay(false); return }
      router.push('/mentorluk')
    })
  }

  if (!onay) {
    return (
      <div className="shrink-0 text-right">
        <button
          onClick={() => setOnay(true)}
          className="inline-flex items-center min-h-[44px] px-2 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Listeden çıkar
        </button>
        {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">{hata}</p>}
      </div>
    )
  }

  return (
    <div className="shrink-0 text-right">
      <p className="text-xs text-gray-600 dark:text-slate-300 mb-1">
        {ad} listeden çıkarılsın mı?
      </p>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setOnay(false)}
          className="inline-flex items-center min-h-[44px] px-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
        >
          Vazgeç
        </button>
        <button
          onClick={cikar}
          disabled={isPending}
          className="inline-flex items-center min-h-[44px] text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 rounded-lg transition-colors"
        >
          {isPending ? 'Çıkarılıyor…' : 'Çıkar'}
        </button>
      </div>
    </div>
  )
}
