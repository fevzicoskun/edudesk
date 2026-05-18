'use client'

import { useState, useTransition } from 'react'
import { revokeToken } from '@/src/domains/tokens/actions'

type TokenType = 'veli' | 'yoklama' | 'tutanak'

export default function RevokeTokenForm() {
  const [token, setToken] = useState('')
  const [type, setType] = useState<TokenType>('veli')
  const [reason, setReason] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setResult(null)
    startTransition(async () => {
      const res = await revokeToken(token.trim(), type, reason.trim() || undefined)
      setResult(res.ok
        ? { ok: true, message: 'Token başarıyla iptal edildi.' }
        : { ok: false, message: res.error ?? 'Bilinmeyen hata' }
      )
      if (res.ok) { setToken(''); setReason('') }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
          Token veya JTI
        </label>
        <textarea
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="v1.eyJ0IjoiZ..."
          rows={3}
          className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono px-3 py-2 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Token Türü</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as TokenType)}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 py-2 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="veli">Veli Portalı</option>
            <option value="yoklama">Yoklama Yazdır</option>
            <option value="tutanak">Tutanak</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Sebep (opsiyonel)</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Güvenlik ihlali vb."
            maxLength={200}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 py-2 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
      </div>

      {result && (
        <div className={`rounded-lg px-3 py-2 text-sm font-medium ${result.ok
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !token.trim()}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isPending ? 'İptal ediliyor...' : 'Token\'ı İptal Et'}
      </button>
    </form>
  )
}
