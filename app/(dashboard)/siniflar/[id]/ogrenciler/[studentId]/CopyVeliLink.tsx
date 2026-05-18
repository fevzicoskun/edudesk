'use client'

import { useState, useTransition } from 'react'
import { generateVeliToken } from '@/src/domains/tokens/actions'

export default function CopyVeliLink({ studentId }: { studentId: string }) {
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleCopy = () => {
    startTransition(async () => {
      try {
        const token = await generateVeliToken(studentId)
        const url = `${window.location.origin}/veli/${token}`
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } catch {
        alert('Link oluşturulamadı. Lütfen tekrar deneyin.')
      }
    })
  }

  return (
    <button
      onClick={handleCopy}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shrink-0 disabled:opacity-60"
    >
      {isPending ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Oluşturuluyor...
        </>
      ) : copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Kopyalandı!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Veli Linkini Kopyala
        </>
      )}
    </button>
  )
}
