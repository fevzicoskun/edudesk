'use client'

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react'
import { bulkDeleteHomeworks } from '@/app/actions/homework'

type BulkCtx = {
  bulkMode: boolean
  selected: Set<string>
  toggle: (id: string) => void
  setBulkMode: (v: boolean) => void
}

const BulkContext = createContext<BulkCtx | null>(null)

export function useBulk() {
  return useContext(BulkContext)
}

export function BulkProvider({ children }: { children: ReactNode }) {
  const [bulkMode, setBulkModeState] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setBulkMode(v: boolean) {
    setBulkModeState(v)
    if (!v) setSelected(new Set())
  }

  function handleDelete() {
    if (!window.confirm(`${selected.size} ödev kalıcı olarak silinecek. Emin misiniz?`)) return
    startTransition(async () => {
      await bulkDeleteHomeworks([...selected])
      setBulkMode(false)
    })
  }

  return (
    <BulkContext.Provider value={{ bulkMode, selected, toggle, setBulkMode }}>
      {children}

      {/* Floating action bar */}
      {bulkMode && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl px-4 py-3">
          <span className="text-sm font-medium whitespace-nowrap">
            {selected.size > 0 ? `${selected.size} ödev seçildi` : 'Ödev seç'}
          </span>
          {selected.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {isPending ? 'Siliniyor...' : 'Seçilenleri Sil'}
            </button>
          )}
          <button
            onClick={() => setBulkMode(false)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            İptal
          </button>
        </div>
      )}
    </BulkContext.Provider>
  )
}

export function BulkModeToggle({ canWrite }: { canWrite: boolean }) {
  const bulk = useBulk()
  if (!canWrite || !bulk) return null

  return (
    <button
      onClick={() => bulk.setBulkMode(!bulk.bulkMode)}
      className={`flex items-center justify-center w-9 h-9 rounded-xl border text-gray-500 shadow-sm transition-all ${
        bulk.bulkMode
          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:text-gray-800 dark:hover:text-slate-200 hover:shadow'
      }`}
      title={bulk.bulkMode ? 'Seçim modundan çık' : 'Toplu işlem'}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    </button>
  )
}
