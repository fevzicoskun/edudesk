'use client'

import { useState, useTransition } from 'react'
import { generateVeliToken } from '@/src/domains/tokens/actions'
import { revokeToken } from '@/app/actions/tokens'

export default function CopyVeliLink({ studentId }: { studentId: string }) {
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoked, setRevoked] = useState(false)
  const [isGenerating, startGenerate] = useTransition()
  const [isRevoking, startRevoke] = useTransition()

  function handleGenerate() {
    startGenerate(async () => {
      try {
        const tok = await generateVeliToken(studentId)
        const url = `${window.location.origin}/veli/${tok}`
        setGeneratedToken(tok)
        setGeneratedUrl(url)
        setRevoked(false)
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } catch {
        alert('Link oluşturulamadı. Lütfen tekrar deneyin.')
      }
    })
  }

  function handleCopy() {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRevoke() {
    if (!generatedToken) return
    startRevoke(async () => {
      const res = await revokeToken(generatedToken, 'veli', 'Öğrenci sayfasından kapatıldı')
      if (res.ok) {
        setRevoked(true)
        setGeneratedToken(null)
        setGeneratedUrl(null)
        setTimeout(() => setRevoked(false), 4000)
      }
    })
  }

  // Revoked state
  if (revoked) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        Veli erişimi kapatıldı
      </div>
    )
  }

  // After generation: show URL + copy + revoke
  if (generatedUrl) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono truncate max-w-[160px] hidden sm:inline">
          {generatedUrl.replace(/^https?:\/\/[^/]+/, '…')}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Kopyalandı
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Kopyala
            </>
          )}
        </button>
        <button
          onClick={handleRevoke}
          disabled={isRevoking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
        >
          {isRevoking ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
          {isRevoking ? 'Kapatılıyor…' : 'Erişimi Kapat'}
        </button>
      </div>
    )
  }

  // Initial state
  return (
    <button
      onClick={handleGenerate}
      disabled={isGenerating}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shrink-0 disabled:opacity-60"
    >
      {isGenerating ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Oluşturuluyor…
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Veli Linkini Oluştur
        </>
      )}
    </button>
  )
}
