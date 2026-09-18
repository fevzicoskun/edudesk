import { useEffect, useRef, useState } from 'react'
import type { SubmissionStatus } from '@/src/shared/types'
import { WeekLoadBadge } from '@/components/homework/WeekLoadBadge'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import { LABELS, BAR_COLORS } from './types'
import type { OzetKalemi } from '@/src/domains/homework/lib/odev-rapor'

/** ⋮ menüsündeki toplu seçenekler — "Hepsi yaptı" birincil olduğu için burada yok */
const IKINCIL_TOPLU: SubmissionStatus[] = ['yapilmadi', 'eksik']

type Props = {
  recordedCount: number
  totalStudents: number
  counts: Record<SubmissionStatus, number>
  /** Sayım satırı — "Girilmedi"yi Yapılmadı'dan ayırır */
  ozet: OzetKalemi[]
  weekLoad: ClassWeekLoad | null
  openBadge: boolean
  onToggleBadge: () => void
  isPending: boolean
  readOnly: boolean
  selectionMode: boolean
  onHepsiYapti: () => void
  onBulkUpdate: (status: SubmissionStatus) => void
  onToggleSelectMode: () => void
  onExportExcel: () => void
  search: string
  onSearchChange: (v: string) => void
  showSearch: boolean
  resultCount: number
}

export default function StatusBoardBar({
  recordedCount, totalStudents, counts, ozet, weekLoad, openBadge, onToggleBadge,
  isPending, readOnly, selectionMode,
  onHepsiYapti, onBulkUpdate, onToggleSelectMode, onExportExcel,
  search, onSearchChange, showSearch, resultCount,
}: Props) {
  const [menuAcik, setMenuAcik]   = useState(false)
  const [aramaAcik, setAramaAcik] = useState(false)
  const menuRef  = useRef<HTMLDivElement>(null)
  const aramaRef = useRef<HTMLInputElement>(null)

  const yuzde        = totalStudents === 0 ? 0 : Math.round(recordedCount / totalStudents * 100)
  const pct          = (n: number) => totalStudents === 0 ? 0 : (n / totalStudents) * 100
  const girilmedi    = Math.max(0, totalStudents - recordedCount)
  const hepsiIsaretli = girilmedi === 0 && totalStudents > 0

  useEffect(() => {
    if (!menuAcik) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAcik(false) }
    document.addEventListener('keydown', onKey)
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [menuAcik])

  useEffect(() => { if (aramaAcik) aramaRef.current?.focus() }, [aramaAcik])

  return (
    <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 pt-1 pb-2 mb-3 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur border-b border-gray-200 dark:border-slate-700 print:hidden">
      <div className="flex items-center gap-3">
        {/* Sol: ilerleme özeti */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 tabular-nums">
              {recordedCount}/{totalStudents}
            </span>
            <span className={`text-xs font-bold tabular-nums ${
              hepsiIsaretli ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-slate-400'
            }`}>
              %{yuzde}
            </span>
            {girilmedi > 0 && (
              <span className="text-xs text-gray-500 dark:text-slate-400 truncate">
                · {girilmedi} öğrenci bekliyor
              </span>
            )}
          </div>
          {/* İnce ilerleme çubuğu */}
          <div className="h-1.5 mt-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${pct(counts.yapildi)}%` }} />
            <div className="bg-orange-400  h-full transition-all duration-500" style={{ width: `${pct(counts.gec)}%` }} />
            <div className="bg-amber-400   h-full transition-all duration-500" style={{ width: `${pct(counts.eksik)}%` }} />
            <div className="bg-red-400     h-full transition-all duration-500" style={{ width: `${pct(Math.max(0, counts.yapilmadi - girilmedi))}%` }} />
            <div className="bg-slate-300   h-full transition-all duration-500" style={{ width: `${pct(counts.mazeretli)}%` }} />
          </div>
        </div>

        {/* Sağ: birincil eylem + araçlar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {weekLoad && weekLoad.count > 0 && (
            <WeekLoadBadge load={weekLoad} open={openBadge} onToggle={onToggleBadge} />
          )}

          {!readOnly && (
            <button
              onClick={onHepsiYapti}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-bold px-3 min-h-[44px] md:min-h-0 md:h-9 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="whitespace-nowrap">Hepsi yaptı</span>
            </button>
          )}

          {showSearch && (
            <button
              onClick={() => { setAramaAcik(a => !a); if (aramaAcik) onSearchChange('') }}
              aria-expanded={aramaAcik}
              aria-label="Öğrenci ara"
              className={`flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:h-9 md:w-9 rounded-lg border transition-colors ${
                aramaAcik || search
                  ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
            </button>
          )}

          <button
            onClick={() => setMenuAcik(m => !m)}
            aria-expanded={menuAcik}
            aria-haspopup="menu"
            aria-label="Diğer araçlar"
            className={`flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:h-9 md:w-9 rounded-lg border transition-colors ${
              menuAcik
                ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sayım satırı — yalnız sıfır olmayanlar; girilmemiş öğrenci "Yapılmadı" sayılmaz */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
        {ozet.map(kalem => (
          <span key={kalem.etiket} className="flex items-center gap-1 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${
              kalem.kod ? BAR_COLORS[kalem.kod] : 'bg-gray-300 dark:bg-slate-600'
            }`} />
            <span className="text-gray-500 dark:text-slate-400">
              {kalem.etiket} <strong className="text-gray-700 dark:text-slate-200 tabular-nums">{kalem.sayi}</strong>
            </span>
          </span>
        ))}
      </div>

      {/* Arama alanı */}
      {aramaAcik && (
        <div className="relative mt-2">
          <input
            ref={aramaRef}
            type="text"
            placeholder="Öğrenci ara..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { onSearchChange(''); setAramaAcik(false) } }}
            aria-label="Öğrenci ara"
            className="w-full pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 placeholder:text-gray-500 dark:placeholder:text-slate-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Aramayı temizle"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-slate-400"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {search && (
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
              {resultCount === 0 ? 'Sonuç bulunamadı.' : `${resultCount} öğrenci gösteriliyor`}
            </p>
          )}
        </div>
      )}

      {/* ⋮ menüsü */}
      {menuAcik && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuAcik(false)} />
          <div
            ref={menuRef}
            role="menu"
            aria-label="Diğer araçlar"
            className="relative z-20 mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-gray-200 dark:border-slate-700"
          >
            {!readOnly && IKINCIL_TOPLU.map(option => (
              <button
                key={option}
                role="menuitem"
                disabled={isPending}
                onClick={() => { onBulkUpdate(option); setMenuAcik(false) }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                Tümü {LABELS[option]}
              </button>
            ))}
            {!readOnly && (
              <button
                role="menuitem"
                onClick={() => { onToggleSelectMode(); setMenuAcik(false) }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-300 transition-colors"
              >
                {selectionMode ? 'Seçimi kapat' : 'Tek tek seç'}
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => { onExportExcel(); setMenuAcik(false) }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-green-300 hover:text-green-700 dark:hover:text-green-400 transition-colors"
            >
              Excel'e aktar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
