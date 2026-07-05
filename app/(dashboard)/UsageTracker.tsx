'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { featureFromPath } from '@/src/shared/usage/featureMap'

// Sayfa-görünümü beacon'ı. Aynı feature içinde gezinme (örn. /yoklama → /yoklama/5a)
// tekrar sayılmaz; feature değişince bir kez gönderilir.
export default function UsageTracker() {
  const pathname = usePathname()
  const lastFeature = useRef<string | null>(null)

  useEffect(() => {
    const feature = featureFromPath(pathname)
    if (!feature || feature === lastFeature.current) return
    lastFeature.current = feature

    const body = JSON.stringify({ feature })
    const blob = new Blob([body], { type: 'application/json' })
    if (!navigator.sendBeacon?.('/api/usage', blob)) {
      // sendBeacon yoksa/reddederse: keepalive fetch, hatası yutulur — metrik kritik değil
      fetch('/api/usage', { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  }, [pathname])

  return null
}
