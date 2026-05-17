'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="text-center">
        <p className="text-5xl font-bold text-gray-200 dark:text-slate-700">!</p>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-4">Bir hata oluştu</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">Beklenmedik bir sorun yaşandı.</p>
        <button
          onClick={reset}
          className="mt-6 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Tekrar dene
        </button>
      </div>
    </div>
  )
}
