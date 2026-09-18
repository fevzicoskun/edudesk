import { useEffect, useRef } from 'react'
import type { SubmissionStatus } from '@/src/shared/types'
import type { SubmissionLogEntry } from '@/src/domains/homework/repositories/HomeworkRepository'
import { LABELS, STYLES, STYLE_TEXT, nextInCycle, relativeTime } from './types'
import type { StatusItem } from './types'

/** Satırda doğrudan gösterilen durumlar; kalanlar ⋯ menüsünde */
const BIRINCIL: SubmissionStatus[] = ['yapildi', 'eksik', 'yapilmadi']
const IKINCIL:  SubmissionStatus[] = ['gec', 'mazeretli']

type Props = {
  item: StatusItem
  status: SubmissionStatus
  note: string
  totalHomeworks: number
  isPending: boolean
  readOnly?: boolean
  noteSaved: boolean
  expandedNote: string | null
  historyOpenId: string | null
  historyLoadingIds: Set<string>
  historyMap: Record<string, SubmissionLogEntry[]>
  menuOpenId: string | null
  onToggleMenu: (studentId: string) => void
  onSetStatus: (studentId: string, status: SubmissionStatus) => void
  onToggleNote: (studentId: string) => void
  onNoteChange: (studentId: string, value: string) => void
  onNoteBlur: (studentId: string, value: string) => void
  onToggleHistory: (studentId: string) => void
  onSelectStudent: (studentId: string) => void
  selectionMode: boolean
  selected: boolean
  onToggleSelect: (studentId: string) => void
}

export default function StudentRow({
  item,
  status,
  note,
  totalHomeworks,
  isPending,
  readOnly = false,
  noteSaved,
  expandedNote,
  historyOpenId,
  historyLoadingIds,
  historyMap,
  menuOpenId,
  onToggleMenu,
  onSetStatus,
  onToggleNote,
  onNoteChange,
  onNoteBlur,
  onToggleHistory,
  onSelectStudent,
  selectionMode,
  selected,
  onToggleSelect,
}: Props) {
  const hasNote       = !!note
  const next          = nextInCycle(status)
  const menuAcik      = menuOpenId === item.student_id
  const ikincilSecili = IKINCIL.includes(status)
  const menuRef       = useRef<HTMLDivElement>(null)

  // Esc ile kapat; açıldığında ilk seçeneğe odaklan
  useEffect(() => {
    if (!menuAcik) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggleMenu(item.student_id) }
    document.addEventListener('keydown', onKey)
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [menuAcik, item.student_id, onToggleMenu])

  return (
    <div
      className={`bg-white dark:bg-slate-800 border rounded-xl px-3 py-2 transition-colors ${
        isPending ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3">
        {selectionMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item.student_id)}
            aria-label={`${item.full_name} seç`}
            className="w-4 h-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        )}

        {/* Sol: isim + künye */}
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onSelectStudent(item.student_id)}
            className="block max-w-full truncate text-sm font-medium text-gray-900 dark:text-slate-100 text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {item.full_name}
          </button>
          <div className="flex items-center gap-2 mt-0.5 min-h-[16px]">
            {item.student_number && (
              <span className="text-xs text-gray-500 dark:text-slate-400 tabular-nums">{item.student_number}</span>
            )}
            {totalHomeworks > 0 && item.missedCount > 0 && (
              <span className={`text-[11px] font-semibold px-1.5 rounded-full ${
                item.missedCount >= Math.ceil(totalHomeworks * 0.5)
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                  : item.missedCount >= 3
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {item.missedCount}/{totalHomeworks} eksik
              </span>
            )}
            <button
              onClick={() => onToggleNote(item.student_id)}
              aria-expanded={expandedNote === item.student_id}
              aria-label={hasNote ? `${item.full_name} notunu düzenle` : `${item.full_name} için not ekle`}
              className={`text-[11px] px-1.5 rounded-full border transition-colors ${
                noteSaved
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : hasNote
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:border-gray-300 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {noteSaved ? '✓ kaydedildi' : hasNote ? 'Not' : '+ not'}
            </button>
            {isPending && (
              <svg className="w-3 h-3 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-label="Kaydediliyor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
        </div>

        {/* Sağ (desktop): 3 birincil durum + ⋯ */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {BIRINCIL.map(option => (
            <button
              key={option}
              disabled={isPending || readOnly}
              onClick={() => onSetStatus(item.student_id, option)}
              aria-pressed={status === option}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed ${
                status === option
                  ? `${STYLES[option]} font-bold`
                  : 'font-medium bg-transparent text-gray-500 border-gray-200 dark:text-slate-400 dark:border-slate-600 hover:border-gray-300 hover:text-gray-700 dark:hover:border-slate-500'
              }`}
            >
              {LABELS[option]}
            </button>
          ))}
          <MenuButton
            open={menuAcik}
            ikincilSecili={ikincilSecili}
            status={status}
            onClick={() => onToggleMenu(item.student_id)}
          />
        </div>

        {/* Sağ (mobil): yalnızca ⋯ — durum değişimi aşağıdaki döngü butonunda */}
        <div className="md:hidden shrink-0">
          <MenuButton
            open={menuAcik}
            ikincilSecili={false}
            status={status}
            onClick={() => onToggleMenu(item.student_id)}
          />
        </div>
      </div>

      {/* Mobil: tek-dokunuş döngü butonu */}
      <button
        disabled={isPending || readOnly}
        onClick={() => onSetStatus(item.student_id, next)}
        className={`md:hidden mt-2 w-full flex items-center justify-between gap-2 px-4 min-h-[48px] rounded-xl border-2 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${STYLES[status]}`}
      >
        <span className="font-bold text-sm">{LABELS[status]}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium opacity-70">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className={STYLE_TEXT[next]}>{LABELS[next]}</span>
        </span>
      </button>

      {/* ⋯ menüsü */}
      {menuAcik && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${item.full_name} için diğer işlemler`}
          className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 flex flex-wrap gap-1.5"
        >
          {!readOnly && IKINCIL.map(option => (
            <button
              key={option}
              role="menuitem"
              disabled={isPending}
              onClick={() => { onSetStatus(item.student_id, option); onToggleMenu(item.student_id) }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed ${
                status === option
                  ? `${STYLES[option]} font-bold`
                  : 'font-medium text-gray-500 border-gray-200 dark:text-slate-400 dark:border-slate-600 hover:border-gray-300'
              }`}
            >
              {LABELS[option]}
            </button>
          ))}
          <button
            role="menuitem"
            onClick={() => { onToggleHistory(item.student_id); onToggleMenu(item.student_id) }}
            className="text-xs px-3 py-1.5 rounded-lg border font-medium text-gray-500 border-gray-200 dark:text-slate-400 dark:border-slate-600 hover:border-gray-300"
          >
            Geçmiş
          </button>
        </div>
      )}

      {expandedNote === item.student_id && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
          <textarea
            value={note}
            onChange={e => onNoteChange(item.student_id, e.target.value)}
            onBlur={e => onNoteBlur(item.student_id, e.target.value)}
            rows={2}
            aria-label={`${item.full_name} için not`}
            placeholder="Öğrenci hakkında kısa not..."
            className="w-full px-3 py-2 text-base border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder:text-gray-500 dark:placeholder:text-slate-400"
          />
        </div>
      )}

      {/* Geçmiş paneli */}
      {historyOpenId === item.student_id && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
          {historyLoadingIds.has(item.student_id) ? (
            <p className="text-xs text-gray-500 dark:text-slate-400">Yükleniyor…</p>
          ) : (historyMap[item.student_id] ?? []).length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-slate-400">Henüz değişiklik kaydı yok.</p>
          ) : (
            <div className="space-y-1.5">
              {(historyMap[item.student_id] ?? []).map((log, idx) => (
                <div key={`${log.changed_at}_${idx}`} className="flex items-baseline gap-2 text-xs">
                  <span className="text-gray-500 dark:text-slate-400 shrink-0 tabular-nums">
                    {relativeTime(log.changed_at)}
                  </span>
                  <span className="min-w-0 text-gray-600 dark:text-slate-300">
                    <span className="font-medium">{log.changed_by_name}</span>
                    {' · '}
                    <span className={log.old_status ? STYLE_TEXT[log.old_status as SubmissionStatus] : 'text-gray-500'}>
                      {log.old_status ? LABELS[log.old_status as SubmissionStatus] : '—'}
                    </span>
                    {' → '}
                    <span className={`font-semibold ${STYLE_TEXT[log.new_status as SubmissionStatus] ?? 'text-gray-500'}`}>
                      {LABELS[log.new_status as SubmissionStatus] ?? log.new_status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Seçili durum ⋯ menüsündeyse butonun kendisi o durumu gösterir.
 *  md:w sabit — buton bazen "⋯", bazen "Mazeretli" gösteriyor; genişliği değişirse
 *  o satırın durum butonları sola kayıp diğer satırlarla hizasını bozuyor. */
function MenuButton({
  open, ikincilSecili, status, onClick,
}: { open: boolean; ikincilSecili: boolean; status: SubmissionStatus; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label="Diğer işlemler"
      className={`flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:h-[34px] md:w-[84px] px-2 rounded-lg border text-xs font-medium transition-colors ${
        ikincilSecili
          ? `${STYLES[status]} font-bold`
          : open
            ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500'
      }`}
    >
      {ikincilSecili ? LABELS[status] : (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="19" cy="12" r="1.75" />
        </svg>
      )}
    </button>
  )
}
