import Link from 'next/link'

// Yoklama ve "bugün son gün" düğmeleri kalktı (2026-09-25): yoklama gizli, bugünkü ödevler üstteki kontrol kartında
export default function HizliAksiyonlar() {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {/* Yeni ödev — her zaman göster */}
      <Link
        href="/odevler/yeni"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-medium border border-gray-200 dark:border-slate-700 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Yeni Ödev
      </Link>
    </div>
  )
}
