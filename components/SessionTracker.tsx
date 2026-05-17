'use client'

import { useEffect } from 'react'
import { heartbeat } from '@/app/actions/session'

const INTERVAL_MS = 5 * 60 * 1000 // 5 dakika

export default function SessionTracker() {
  useEffect(() => {
    const id = setInterval(() => { heartbeat() }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return null
}
