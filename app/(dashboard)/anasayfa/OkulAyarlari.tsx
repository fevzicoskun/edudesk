'use client'

import { useState, useTransition, useActionState } from 'react'
import { regenerateSchoolCode, updateSchoolSettings } from '@/src/domains/school/actions'

export default function OkulAyarlari({
  initialName,
  initialCode,
}: {
  initialName: string
  initialCode: string
}) {
  const [code, setCode]   = useState(initialCode)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [nameState, nameAction, namePending] = useActionState(updateSchoolSettings, null)

  const handleCopy = () => {
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleRegenerate = () => {
    startTransition(async () => {
      const res = await regenerateSchoolCode()
      if (res && 'code' in res && res.code) setCode(res.code)
    })
  }

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Okul Ayarları</h2>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-xs text-blue-600 font-medium hover:underline"
        >
          {editing ? 'Kapat' : 'Düzenle'}
        </button>
      </div>

      {/* Okul adı güncelleme */}
      {editing && (
        <form action={nameAction} className="mb-4">
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Okul Adı</label>
          <div className="flex gap-2">
            <input
              name="name"
              defaultValue={initialName}
              required
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={namePending}
              className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Kaydet
            </button>
          </div>
          {nameState?.error && <p className="text-xs text-red-500 mt-1">{nameState.error}</p>}
          {nameState?.success && <p className="text-xs text-emerald-600 mt-1">Kaydedildi.</p>}
        </form>
      )}

      {/* Katılım kodu */}
      <div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Öğretmen Katılım Kodu</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-3 text-center">
            <span className="text-2xl font-bold tracking-[0.3em] text-gray-900 dark:text-slate-100 font-mono">
              {code || '—'}
            </span>
          </div>
          <button
            onClick={handleCopy}
            disabled={!code}
            className="px-3 py-3 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-600 dark:text-slate-400 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 transition-colors"
            title="Kodu kopyala"
          >
            {copied ? (
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isPending}
            className="px-3 py-3 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-600 dark:text-slate-400 hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition-colors"
            title="Yeni kod oluştur"
          >
            {isPending ? '…' : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
          Bu kodu öğretmenlerle paylaş. Kayıt sayfası:{' '}
          <span className="font-medium text-gray-600 dark:text-slate-300">/kayit</span>
        </p>
      </div>
    </section>
  )
}
