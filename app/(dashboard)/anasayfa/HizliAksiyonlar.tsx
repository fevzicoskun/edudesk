import Link from 'next/link'
import type { YoklamaDurumItem } from '@/src/domains/dashboard/types'

interface Props {
  yoklamaDurumu: YoklamaDurumItem[]
  bugunHwSayisi: number
}

export default function HizliAksiyonlar({ yoklamaDurumu, bugunHwSayisi }: Props) {
  const eksikYoklama = yoklamaDurumu.filter(c => !c.alindi)
  const firstEksik = eksikYoklama[0]

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {/* Yoklama al — en öncelikli aksiyon */}
      {firstEksik ? (
        <Link
          href="/yoklama"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Yoklama Al — {firstEksik.className}
          {eksikYoklama.length > 1 && (
            <span className="ml-0.5 bg-white/20 rounded px-1 text-[10px]">+{eksikYoklama.length - 1}</span>
          )}
        </Link>
      ) : (
        <Link
          href="/yoklama"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Yoklama Tamam
        </Link>
      )}

      {/* Bugün son gün */}
      {bugunHwSayisi > 0 && (
        <Link
          href="/odevler"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          Bugün son gün: {bugunHwSayisi} ödev
        </Link>
      )}

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
