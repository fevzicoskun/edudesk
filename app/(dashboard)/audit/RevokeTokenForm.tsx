'use client'

import { useState, useTransition } from 'react'
import { revokeToken } from '@/src/domains/tokens/actions'

const LINK_TYPES = [
  { value: 'veli',    label: 'Veli Portalı'      },
  { value: 'yoklama', label: 'Yoklama Sayfası'   },
  { value: 'tutanak', label: 'Toplantı Tutanağı' },
] as const

type LinkType = typeof LINK_TYPES[number]['value']

export default function RevokeTokenForm() {
  const [token,   setToken]   = useState('')
  const [type,    setType]    = useState<LinkType>('veli')
  const [reason,  setReason]  = useState('')
  const [result,  setResult]  = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setResult(null)
    startTransition(async () => {
      const res = await revokeToken(token.trim(), type, reason.trim() || undefined)
      setResult(res.ok
        ? { ok: true,  message: 'Erişim başarıyla kapatıldı.' }
        : { ok: false, message: res.error ?? 'Bilinmeyen hata oluştu.' }
      )
      if (res.ok) { setToken(''); setReason('') }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
          Link veya Erişim Kodu
        </label>
        <textarea
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="https://…/veli/v1.xxx  veya sadece kodu yapıştırın"
          rows={2}
          className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono px-3 py-2 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Link Türü</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as LinkType)}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 py-2 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {LINK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Kapatma Sebebi <span className="font-normal text-gray-400">(opsiyonel)</span></label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ör: Öğrenci nakil oldu"
            maxLength={200}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 py-2 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
      </div>

      {result && (
        <div className={`rounded-lg px-3 py-2 text-sm font-medium ${result.ok
          ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800'
          : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'}`}>
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !token.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Kapatılıyor…
          </>
        ) : 'Erişimi Kapat'}
      </button>
    </form>
  )
}
