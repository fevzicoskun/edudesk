'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { globalSearch, type SearchResult } from '@/app/actions/search'

const DEFAULT_PAGES: SearchResult[] = [
  { type: 'page', id: 'anasayfa',      title: 'Anasayfa',           subtitle: 'Sayfa',  href: '/anasayfa' },
  { type: 'page', id: 'odevler',       title: 'Ödevler',            subtitle: 'Sayfa',  href: '/odevler' },
  { type: 'page', id: 'odevler-yeni',  title: 'Yeni Ödev Oluştur',  subtitle: 'Ödevler', href: '/odevler/yeni' },
  { type: 'page', id: 'siniflar',      title: 'Sınıflar',           subtitle: 'Sayfa',  href: '/siniflar' },
  { type: 'page', id: 'yoklama',       title: 'Yoklama',            subtitle: 'Sayfa',  href: '/yoklama' },
]

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  page: 'Sayfa',
  student: 'Öğrenci',
  homework: 'Ödev',
}

function ResultIcon({ type }: { type: SearchResult['type'] }) {
  if (type === 'student') return (
    <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
  if (type === 'homework') return (
    <svg className="w-4 h-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
  return (
    <svg className="w-4 h-4 shrink-0 text-gray-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  )
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+K / Ctrl+K global listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Auto-focus + reset when opening
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch(q)
        setResults(res)
        setSelected(0)
      })
    }, 280)
  }, [])

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (val.trim().length >= 2) {
      search(val)
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setResults([])
      setSelected(0)
    }
  }

  const displayList = query.trim().length >= 2 ? results : DEFAULT_PAGES

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(v => Math.min(v + 1, displayList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(v => Math.max(v - 1, 0))
    } else if (e.key === 'Enter') {
      const item = displayList[selected]
      if (item) navigate(item.href)
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  // Group results by type for display
  const groups: { label: string; items: (SearchResult & { globalIdx: number })[] }[] = []
  const grouped = new Map<string, (SearchResult & { globalIdx: number })[]>()
  displayList.forEach((item, i) => {
    const key = TYPE_LABELS[item.type]
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push({ ...item, globalIdx: i })
  })
  grouped.forEach((items, label) => groups.push({ label, items }))

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-slate-800">
          {isPending ? (
            <svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500 dark:text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Sayfa, öğrenci veya ödev ara..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-slate-600 border border-gray-200 dark:border-slate-700 rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[340px] overflow-y-auto py-2">
          {displayList.length === 0 && query.trim().length >= 2 && !isPending ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">
              &ldquo;{query}&rdquo; için sonuç bulunamadı
            </div>
          ) : (
            groups.map(({ label, items }) => (
              <div key={label}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-600">
                  {label}
                </div>
                {items.map(({ globalIdx, ...item }) => (
                  <button
                    key={item.id}
                    data-idx={globalIdx}
                    onMouseEnter={() => setSelected(globalIdx)}
                    onClick={() => navigate(item.href)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      selected === globalIdx
                        ? 'bg-blue-50 dark:bg-blue-950/40'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <ResultIcon type={item.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {selected === globalIdx && (
                      <kbd className="text-[10px] text-gray-400 dark:text-slate-600 border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5 shrink-0">
                        ↵
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800 flex items-center gap-4 text-[11px] text-gray-400 dark:text-slate-600">
          <span><kbd className="font-mono">↑↓</kbd> gezin</span>
          <span><kbd className="font-mono">↵</kbd> git</span>
          <span><kbd className="font-mono">Esc</kbd> kapat</span>
        </div>
      </div>
    </div>
  )
}
