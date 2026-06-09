'use client'

import { useEffect, useState } from 'react'

type PushState = 'unsupported' | 'loading' | 'denied' | 'subscribed' | 'unsubscribed'

export default function WebPushButton() {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    const perm = Notification.permission
    if (perm === 'denied') { setState('denied'); return }

    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? 'subscribed' : 'unsubscribed')
      })
    )
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
    } catch {
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
    } catch {
      setState('unsubscribed')
    }
  }

  if (state === 'unsupported') return null

  return (
    <div className="flex items-center gap-3">
      {state === 'subscribed' ? (
        <>
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Tarayıcı bildirimleri açık
          </span>
          <button
            onClick={unsubscribe}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
          >
            Kapat
          </button>
        </>
      ) : state === 'denied' ? (
        <span className="text-sm text-amber-600 dark:text-amber-400">
          Bildirim izni reddedildi — tarayıcı ayarlarından etkinleştirin
        </span>
      ) : (
        <button
          onClick={subscribe}
          disabled={state === 'loading'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {state === 'loading' ? 'Yükleniyor...' : 'Tarayıcı bildirimleri aç'}
        </button>
      )}
    </div>
  )
}
