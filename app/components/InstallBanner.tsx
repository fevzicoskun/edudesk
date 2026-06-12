'use client'

import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'pwa-install-dismissed'

export default function InstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return
    } catch {
      return
    }

    const show = () => setVisible(true)
    window.addEventListener('pwa-install-ready', show)
    return () => window.removeEventListener('pwa-install-ready', show)
  }, [])

  async function handleInstall() {
    const prompt = window.__pwaInstallPrompt
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
    }
    setVisible(false)
  }

  function handleDismiss() {
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl shadow-lg p-4 flex items-center gap-3">
        <img src="/icon-192.png" alt="EduDesk" className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Ana ekrana ekle</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Hızlı erişim için yükle</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 px-2 py-1 transition-colors"
            aria-label="Kapat"
          >
            Kapat
          </button>
          <button
            onClick={handleInstall}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Yükle
          </button>
        </div>
      </div>
    </div>
  )
}
