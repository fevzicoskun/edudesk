'use client'

import { useCallback, useEffect, useState } from 'react'
import EduDeskLogo from '@/components/EduDeskLogo'

type Status = 'idle' | 'checking' | 'failed'

export default function OfflinePage() {
  const [lastOnline, setLastOnline] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    try {
      const t = localStorage.getItem('edudesk-last-online')
      if (t) setLastOnline(new Date(t).toLocaleString('tr-TR'))
    } catch {}
  }, [])

  // Bağlantıyı ucuz bir probe ile yokla; GERÇEKTEN erişilebilirse sayfayı
  // yeniden yükle. SW navigation fallback URL'i koruduğu için reload orijinal
  // sayfayı tekrar ister. Sadece `online` event'ine güvenmiyoruz çünkü ağ
  // arayüzü geri gelse de internet hâlâ kararsız olabilir.
  const tryReconnect = useCallback(async () => {
    setStatus('checking')
    try {
      const res = await fetch('/api/live', { cache: 'no-store' })
      if (res.ok) {
        window.location.reload()
        return
      }
    } catch {
      /* hâlâ erişilemiyor */
    }
    setStatus('failed')
  }, [])

  // Tarayıcı ağ bağlantısını geri kazanınca otomatik dene.
  useEffect(() => {
    const onOnline = () => { void tryReconnect() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [tryReconnect])

  const checking = status === 'checking'

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
      <EduDeskLogo size="lg" className="mb-6" />
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        İnternet bağlantısı yok
      </h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-xs">
        {status === 'failed'
          ? 'Hâlâ bağlanılamadı. Bağlantınızı kontrol edip tekrar deneyin.'
          : 'Bağlantınızı kontrol edip tekrar deneyin. Bağlantı dönünce sayfa otomatik yenilenir.'}
        {lastOnline && (
          <>
            <br />
            <span className="text-xs">Son çevrimiçi: {lastOnline}</span>
          </>
        )}
      </p>
      <button
        onClick={() => void tryReconnect()}
        disabled={checking}
        aria-busy={checking}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {checking ? 'Bağlanılıyor…' : 'Yeniden dene'}
      </button>
    </div>
  )
}
