'use client'

import { useState, useEffect, useTransition } from 'react'
import { generateVeliToken, revokeToken, getActiveVeliTokens } from '@/src/domains/tokens/actions'

type VeliToken = { jti: string; expires_at: string; created_at: string }

function timeLeft(expiresAt: string): string {
  const hours = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 3_600_000)
  if (hours < 1) return 'Az kaldı'
  if (hours < 24) return `${hours} saat kaldı`
  return `${Math.floor(hours / 24)} gün kaldı`
}

export default function CopyVeliLink({ studentId }: { studentId: string }) {
  const [tokens, setTokens] = useState<VeliToken[]>([])
  const [loading, setLoading] = useState(true)
  // Newly generated token with its full URL (only available in current session)
  const [fresh, setFresh] = useState<{ jti: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokingJti, setRevokingJti] = useState<string | null>(null)
  const [isGenerating, startGenerate] = useTransition()

  useEffect(() => {
    getActiveVeliTokens(studentId).then(data => {
      setTokens(data)
      setLoading(false)
    })
  }, [studentId])

  function handleGenerate() {
    startGenerate(async () => {
      try {
        const tok = await generateVeliToken(studentId)
        const url = `${window.location.origin}/veli/${tok}`
        // Refresh list to get the new token's jti
        const updated = await getActiveVeliTokens(studentId)
        // The newest token is first (ordered by created_at desc)
        const newJti = updated[0]?.jti ?? null
        setTokens(updated)
        if (newJti) setFresh({ jti: newJti, url })
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } catch {
        alert('Link oluşturulamadı. Lütfen tekrar deneyin.')
      }
    })
  }

  function handleCopy() {
    if (!fresh) return
    navigator.clipboard.writeText(fresh.url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleRevoke(jti: string) {
    setRevokingJti(jti)
    const result = await revokeToken(jti, 'veli')
    setRevokingJti(null)
    if (result.ok) {
      setTokens(prev => prev.filter(t => t.jti !== jti))
      if (fresh?.jti === jti) setFresh(null)
    } else {
      alert(result.error ?? 'Link devre dışı bırakılamadı.')
    }
  }

  if (loading) {
    return <span className="text-xs text-gray-400 dark:text-slate-500">Yükleniyor…</span>
  }

  // Tokens excluding the fresh one (fresh is shown separately with copy button)
  const oldTokens = tokens.filter(t => t.jti !== fresh?.jti)

  return (
    <div className="flex flex-col gap-2">
      {/* Newly generated token — shows URL + copy */}
      {fresh && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-slate-500 font-mono truncate max-w-[160px] hidden sm:inline">
            {fresh.url.replace(/^https?:\/\/[^/]+/, '…')}
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Kopyala
              </>
            )}
          </button>
          <RevokeButton jti={fresh.jti} isRevoking={revokingJti === fresh.jti} onRevoke={handleRevoke} />
        </div>
      )}

      {/* Older active tokens — only revoke, URL no longer available */}
      {oldTokens.map(t => (
        <div key={t.jti} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            {timeLeft(t.expires_at)}
          </span>
          <RevokeButton jti={t.jti} isRevoking={revokingJti === t.jti} onRevoke={handleRevoke} />
        </div>
      ))}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
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
            {tokens.length > 0 ? 'Yeni Link Oluştur' : 'Veli Linkini Oluştur'}
          </>
        )}
      </button>
    </div>
  )
}

function RevokeButton({ jti, isRevoking, onRevoke }: { jti: string; isRevoking: boolean; onRevoke: (jti: string) => void }) {
  return (
    <button
      onClick={() => onRevoke(jti)}
      disabled={isRevoking}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-60"
    >
      {isRevoking ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Bırakılıyor…
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Devre Dışı Bırak
        </>
      )}
    </button>
  )
}
