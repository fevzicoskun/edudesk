'use client'

import NotificationBell from '@/components/NotificationBell'

// Masaüstü üst bar: sağ üstte arama tetikleyici (CommandPalette'i Ctrl+K ile açar) + bildirim zili.
// Mobilde gizli — mobil header'ı Sidebar render ediyor.
export default function TopBar({ userId }: { userId?: string }) {
  function openSearch() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
  }

  return (
    <header className="hidden md:flex items-center justify-end gap-4 h-16 shrink-0 px-6 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
      <button
        type="button"
        onClick={openSearch}
        title="Ara (Ctrl+K)"
        className="group flex items-center gap-3 w-80 max-w-full px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 text-left text-sm">Öğrenci veya ödev ara...</span>
        <kbd className="hidden lg:inline text-[10px] border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
      <NotificationBell align="right" userId={userId} />
    </header>
  )
}
