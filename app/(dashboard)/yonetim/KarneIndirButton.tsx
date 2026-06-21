'use client'

import { useState } from 'react'
import { getOkulKarnesi } from '@/app/actions/karne'
import { buildKarnePdf } from './karnePdf'
import { useToast } from '@/components/Toast'

export default function KarneIndirButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleClick() {
    setLoading(true)
    try {
      const data = await getOkulKarnesi()
      await buildKarnePdf(data)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Karne oluşturulamadı', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Hazırlanıyor…' : 'Karne (PDF) indir'}
    </button>
  )
}
