'use client'

import { useState } from 'react'

export default function KopyalaButonu({ metin }: { metin: string }) {
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
      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
    >
      <span aria-live="polite">{durum === 'tamam' ? 'Kopyalandı ✓' : durum === 'hata' ? 'Kopyalanamadı' : 'Listeyi kopyala'}</span>
    </button>
  )
}
