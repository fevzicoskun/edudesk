'use client'
import { useState } from 'react'

export default function CopySqlButton({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-green-300 transition-colors"
    >
      {copied ? '✅ Kopyalandı' : 'Kopyala'}
    </button>
  )
}
