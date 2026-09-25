'use client'

import { useState } from 'react'

export default function KopyalaButonu({ metin, etiket = 'Listeyi kopyala', ariaLabel }: { metin: string; etiket?: string; ariaLabel?: string }) {
  const [durum, setDurum] = useState<'bos' | 'tamam' | 'hata'>('bos')

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(metin)
      setDurum('tamam')
    } catch {
      setDurum('hata')
    }
    setTimeout(() => setDurum('bos'), 2000)
  }

  return (
    <button
      type="button"
      onClick={kopyala}
      aria-label={ariaLabel}
      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
    >
      <span aria-live="polite">{durum === 'tamam' ? 'Kopyalandı ✓' : durum === 'hata' ? 'Kopyalanamadı' : etiket}</span>
    </button>
  )
}
