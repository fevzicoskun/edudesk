'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addMentorship } from '@/app/actions/mentor'

/** Mentörü olmayan öğrenciyi kendi mentörlüğüne ekleme — menüde Mentörlük olmayan öğretmenin ilk giriş yolu. */
export default function MentorlugumeEkle({ studentId }: { studentId: string }) {
  const router = useRouter()
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function ekle() {
    setHata(null)
    startTransition(async () => {
      const r = await addMentorship(studentId)
      if (r.error) setHata(r.error)
      else router.refresh() // "Mentörü: …" satırı ve menüdeki Mentörlük girişi sunucudan yenilenir
    })
  }

  return (
    <div className="mt-1">
      <button
        onClick={ekle}
        disabled={isPending}
        className="inline-flex items-center min-h-[44px] px-2 -ml-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
      >
        {isPending ? 'Ekleniyor…' : 'Mentörlüğüme ekle'}
      </button>
      {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{hata}</p>}
    </div>
  )
}
