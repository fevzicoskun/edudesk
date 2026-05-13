'use client'
import { useState } from 'react'

export default function SetupBanner({ title, sql }: { title: string; sql: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-5 mb-6">
      <h2 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">{title}</h2>
      <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
        Supabase Dashboard › SQL Editor&apos;e kopyalayıp çalıştır, ardından sayfayı yenile.
      </p>
      <div className="relative">
        <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
          {sql}
        </pre>
        <button
          onClick={copy}
          className="absolute top-2 right-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-green-300 transition-colors"
        >
          {copied ? '✅ Kopyalandı' : 'Kopyala'}
        </button>
      </div>
    </div>
  )
}
