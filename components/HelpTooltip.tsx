'use client'

import { useState, useEffect, useRef } from 'react'

export default function HelpTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-400 transition-colors flex items-center justify-center text-xs font-bold"
        aria-label="Yardım"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-50 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-3">
          <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">{content}</p>
        </div>
      )}
    </div>
  )
}
