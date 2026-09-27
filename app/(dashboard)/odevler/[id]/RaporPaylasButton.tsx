'use client'

import { useState } from 'react'
import { raporuPaylas } from '@/src/domains/homework/lib/raporPaylas'

/** Yazdırma raporunu resim olarak telefonun paylaşım menüsüne (WhatsApp vb.) verir */
export default function RaporPaylasButton({ sinif }: { sinif: string }) {
  const [durum, setDurum] = useState<'bos' | 'hazirlaniyor' | 'hata'>('bos')

  async function paylas() {
    setDurum('hazirlaniyor')
    try {
      await raporuPaylas(sinif)
      setDurum('bos')
    } catch (e) {
      console.error('Rapor paylaşılamadı', e)
      setDurum('hata')
    }
  }

  return (
    <span className="inline-flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={paylas}
        disabled={durum === 'hazirlaniyor'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400 transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {durum === 'hazirlaniyor' ? 'Hazırlanıyor…' : 'Paylaş'}
      </button>
      {durum === 'hata' && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          Rapor resmi oluşturulamadı, tekrar dene.
        </span>
      )}
    </span>
  )
}
