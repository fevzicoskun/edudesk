'use client'

import { useEffect, useState } from 'react'

export type PushState = 'unsupported' | 'loading' | 'denied' | 'subscribed' | 'unsubscribed'

// Web push abonelik durum makinesi — WebPushButton'dan çıkarıldı (DRY),
// PushTesvikSeridi ile paylaşılır. Davranış birebir aynıdır.
export function usePushSubscription() {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    // VAPID public key tanımlı değilse subscribe edilemez — hiç gösterme
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setState('denied'); return }

    navigator.serviceWorker.getRegistration('/sw.js')
      .then((reg) => {
        if (!reg) { setState('unsubscribed'); return }
        reg.pushManager.getSubscription().then((sub) => {
          setState(sub ? 'subscribed' : 'unsubscribed')
        })
      })
      .catch(() => setState('unsubscribed'))
  }, [])

  async function subscribe() {
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState('denied'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      setState(res.ok ? 'subscribed' : 'unsubscribed')
    } catch (e) {
      console.error('[usePushSubscription] subscribe:', e)
      setState('unsubscribed')
    }
  }

  async function unsubscribe() {
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch (e) {
      console.error('[usePushSubscription] unsubscribe:', e)
      setState('unsubscribed')
    }
  }

  return { state, subscribe, unsubscribe }
}
