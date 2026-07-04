'use client'

import { usePushSubscription } from '../usePushSubscription'

export default function WebPushButton() {
  const { state, subscribe, unsubscribe } = usePushSubscription()

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
