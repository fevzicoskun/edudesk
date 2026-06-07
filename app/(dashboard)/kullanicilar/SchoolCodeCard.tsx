'use client'

import { useState, useTransition } from 'react'
import { regenerateSchoolCode } from '@/app/actions/school'

const SCHOOL_CODE_RE = /^[A-Za-z]{3,4}\d{3,4}$/

export default function SchoolCodeCard({ initialCode }: { initialCode: string | null }) {
  const [code, setCode] = useState(
    initialCode && SCHOOL_CODE_RE.test(initialCode) ? initialCode : null
  )
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCopy() {
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRegen() {
    startTransition(async () => {
      setError(null)
      const result = await regenerateSchoolCode()
      if (result?.error) setError(result.error)
      else if (result?.code) setCode(result.code)
    })
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Öğretmen Katılım Kodu</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Öğretmenler kayıt sırasında bu kodu kullanır
          </p>
        </div>
        <button
          onClick={handleRegen}
          disabled={isPending}
          className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 transition-colors underline-offset-2 hover:underline"
        >
          {isPending ? 'Oluşturuluyor…' : 'Yeni Kod'}
        </button>
      </div>

      {code ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-center font-mono text-xl sm:text-2xl font-bold tracking-[0.2em] text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-lg py-2.5 px-4">
            {code}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-2.5 border border-blue-200 dark:border-blue-700 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
          >
            {copied ? '✓ Kopyalandı' : 'Kopyala'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-blue-500 dark:text-blue-400">
          Henüz katılım kodu yok.{' '}
          <button
            onClick={handleRegen}
            disabled={isPending}
            className="underline hover:no-underline disabled:opacity-50"
          >
            Kod oluştur
          </button>
        </p>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  )
}
