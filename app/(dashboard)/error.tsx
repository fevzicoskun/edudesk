'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { reportClientError } from '@/app/actions/error-report'

// Dashboard segment hata sınırı: sidebar/topbar ayakta kalır, kullanıcı navigasyonu kaybetmez.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError({
      message: (error.message || 'Bilinmeyen istemci hatası').slice(0, 500),
      digest:  error.digest,
      url:     typeof window !== 'undefined' ? window.location.href.slice(0, 200) : undefined,
    }).catch(() => { /* raporlama hatası UI'ı etkilemesin */ })
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center mt-8">
        <p className="text-5xl font-bold text-gray-200 dark:text-slate-700">!</p>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-4">Bir hata oluştu</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
          Bu sayfa yüklenirken beklenmedik bir sorun yaşandı.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Tekrar dene
          </button>
          <Link
            href="/anasayfa"
            className="border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  )
}
