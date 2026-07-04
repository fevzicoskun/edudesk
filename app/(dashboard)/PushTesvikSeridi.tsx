'use client'

import { useEffect, useState } from 'react'
import { usePushSubscription } from './usePushSubscription'
import { shouldShowPushNudge, NUDGE_STORAGE_KEY } from '@/src/domains/dashboard/lib/pushNudge'

// Push teşvik şeridi: abone olmayan kullanıcıya nazik hatırlatma.
// İlk boyamada gizli (async kontrol); "Daha sonra" 14 gün susturur (localStorage);
// abone olunca / izin reddedilince kaybolur. Spec: 2026-07-04-push-tesvik-seridi-design.md
export default function PushTesvikSeridi() {
  const { state, subscribe } = usePushSubscription()
  const [snoozed, setSnoozed] = useState<boolean | null>(null) // null = henüz bakılmadı (ilk boyama gizli)
  const [busy, setBusy] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)

  useEffect(() => {
    let dismissedAt: string | null = null
    try {
      dismissedAt = localStorage.getItem(NUDGE_STORAGE_KEY)
    } catch {
      // gizli mod vb. — snooze okunamazsa göster (fail-open)
    }
    setSnoozed(!shouldShowPushNudge(dismissedAt))
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(NUDGE_STORAGE_KEY, new Date().toISOString())
    } catch {
      // yazılamazsa bir dahaki sefere yine görünür — kabul edilmiş davranış
    }
    setSnoozed(true)
  }

  async function enable() {
    setBusy(true)
    await subscribe()
    setBusy(false)
    setJustEnabled(true)
    // ✓ onayı kısa yaşasın — client-side nav'da oturum boyu asılı kalmasın (toast deseni)
    setTimeout(() => setJustEnabled(false), 5000)
  }

  if (snoozed !== false) return null

  // Başarı: bu oturumda abone olundu → kısa onay (5 sn sonra kaybolur)
  if (justEnabled && state === 'subscribed') {
    return (
      <div className="px-4 pt-4 md:px-6 max-w-6xl mx-auto print:hidden">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Bildirimler açıldı ✓ — sabah özetin artık telefonuna gelecek.
        </div>
      </div>
    )
  }

  // unsupported / denied / (önceden) subscribed / ilk-yükleme loading → gizli
  if (state !== 'unsubscribed' && !busy) return null

  return (
    <div className="px-4 pt-4 md:px-6 max-w-6xl mx-auto print:hidden">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <span aria-hidden>🔔</span>
        <span className="text-sm text-gray-700 dark:text-slate-300 flex-1 min-w-48">
          Sabah özetini ve bildirimleri telefonuna al
        </span>
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {busy ? 'Açılıyor…' : 'Bildirimleri aç'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Daha sonra hatırlat"
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-2 transition-colors"
        >
          Daha sonra
        </button>
      </div>
    </div>
  )
}
