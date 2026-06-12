'use client'

import { useEffect } from 'react'

interface Props { token: string }

export default function VeliTracker({ token }: Props) {
  useEffect(() => {
    const startTime   = Date.now()
    const seenSections = new Set<string>()

    fetch('/api/veli/event', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, event_type: 'page_view' }),
    }).catch(() => {})

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const section = (entry.target as HTMLElement).dataset.veliSection
          if (!section || seenSections.has(section)) continue
          seenSections.add(section)
          fetch('/api/veli/event', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token, event_type: 'section_view', section }),
          }).catch(() => {})
        }
      },
      { threshold: 0.3 }
    )
    document.querySelectorAll('[data-veli-section]').forEach(el => observer.observe(el))

    const handleHidden = () => {
      if (document.visibilityState !== 'hidden') return
      const durationSec = Math.round((Date.now() - startTime) / 1000)
      navigator.sendBeacon(
        '/api/veli/event',
        new Blob(
          [JSON.stringify({ token, event_type: 'session_end', duration_sec: durationSec })],
          { type: 'application/json' }
        )
      )
    }
    document.addEventListener('visibilitychange', handleHidden)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleHidden)
    }
  }, [token])

  return null
}
