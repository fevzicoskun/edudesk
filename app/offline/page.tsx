'use client'

import { useEffect, useState } from 'react'
import EduDeskLogo from '@/components/EduDeskLogo'

export default function OfflinePage() {
  const [lastOnline, setLastOnline] = useState<string | null>(null)

  useEffect(() => {
    try {
      const t = localStorage.getItem('edudesk-last-online')
      if (t) setLastOnline(new Date(t).toLocaleString('tr-TR'))
    } catch {}
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
      <EduDeskLogo size="lg" className="mb-6" />
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        İnternet bağlantısı yok
      </h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-xs">
        Bağlantınızı kontrol edip tekrar deneyin.
        {lastOnline && (
          <>
            <br />
            <span className="text-xs">Son çevrimiçi: {lastOnline}</span>
          </>
        )}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Yeniden dene
      </button>
    </div>
  )
}
