import type { SubmissionStatus } from '@/src/shared/types'
import type { SubmissionLogEntry } from '@/src/domains/homework/repositories/HomeworkRepository'
import { LABELS, STYLES, STYLE_TEXT, nextInCycle, relativeTime } from './types'
import type { StatusItem } from './types'

type Props = {
  item: StatusItem
  status: SubmissionStatus
  note: string
  totalHomeworks: number
  isPending: boolean
  noteSaved: boolean
  expandedNote: string | null
  historyOpenId: string | null
  historyLoadingIds: Set<string>
  historyMap: Record<string, SubmissionLogEntry[]>
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
  noteSaved,
  expandedNote,
  historyOpenId,
  historyLoadingIds,
  historyMap,
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
  const hasNote = !!note
  const next    = nextInCycle(status)

  return (
    <div
      className={`bg-white dark:bg-slate-800 border rounded-xl px-4 py-3 transition-colors ${
        isPending ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-slate-700'
      }`}
    >
      {selectionMode && (
        <div className="mb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(item.student_id)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500 dark:text-slate-400">Seç</span>
          </label>
        </div>
      )}
      {/* Üst satır: isim + geçmiş + not butonu */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 pt-0.5">
          <button
            onClick={() => onSelectStudent(item.student_id)}
            className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {item.full_name}
          </button>
          <div className="flex items-center gap-2 mt-0.5">
            {item.student_number && (
              <span className="text-xs text-gray-500 dark:text-slate-400">No: {item.student_number}</span>
            )}
            {totalHomeworks > 0 && item.missedCount > 0 && (
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                item.missedCount >= Math.ceil(totalHomeworks * 0.5)
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                  : item.missedCount >= 3
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {item.missedCount}/{totalHomeworks} eksik
              </span>
            )}
            {isPending && (
              <svg className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Geçmiş butonu */}
          <button
            onClick={() => onToggleHistory(item.student_id)}
            aria-expanded={historyOpenId === item.student_id}
            aria-label="Durum geçmişi"
            className={`flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:h-8 md:w-8 rounded-lg border transition-colors ${
              historyOpenId === item.student_id
                ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500'
            }`}
          >
            {historyLoadingIds.has(item.student_id) ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          {/* Not butonu */}
          <button
            onClick={() => onToggleNote(item.student_id)}
            className={`text-xs px-2.5 min-h-[44px] min-w-[64px] md:min-h-0 md:min-w-0 md:h-8 rounded-lg border transition-colors ${
              noteSaved
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : hasNote
                  ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300'
            }`}
          >
            {noteSaved ? '✓ Kaydedildi' : hasNote ? 'Not ✓' : '+ Not'}
          </button>
        </div>
      </div>

      {/* Mobil: tek-dokunuş döngü butonu */}
      <button
        disabled={isPending}
        onClick={() => onSetStatus(item.student_id, next)}
        className={`md:hidden w-full flex items-center justify-between gap-2 px-4 min-h-[52px] rounded-xl border-2 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${STYLES[status]}`}
      >
        <span className="font-bold text-sm">{LABELS[status]}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium opacity-70">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className={STYLE_TEXT[next]}>{LABELS[next]}</span>
        </span>
      </button>

      {/* Desktop: 3+2 buton grid */}
      <div className="hidden md:grid grid-cols-3 gap-1.5 mb-1.5">
        {(['yapildi', 'eksik', 'yapilmadi'] as SubmissionStatus[]).map(option => (
          <button
            key={option}
            disabled={isPending}
            onClick={() => onSetStatus(item.student_id, option)}
            className={`text-xs px-2 py-1.5 rounded-xl border transition-colors min-h-[44px] md:min-h-0 flex items-center justify-center disabled:cursor-not-allowed ${
              status === option
                ? `${STYLES[option]} ring-2 ring-current font-bold`
                : 'font-medium bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
            }`}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>
      <div className="hidden md:grid grid-cols-2 gap-1.5">
        {(['gec', 'mazeretli'] as SubmissionStatus[]).map(option => (
          <button
            key={option}
            disabled={isPending}
            onClick={() => onSetStatus(item.student_id, option)}
            className={`text-xs px-2 py-1.5 rounded-xl border transition-colors min-h-[44px] md:min-h-0 flex items-center justify-center disabled:cursor-not-allowed ${
              status === option
                ? `${STYLES[option]} ring-2 ring-current font-bold`
                : 'font-medium bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
            }`}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>

      {expandedNote === item.student_id && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-700">
          <textarea
            value={note}
            onChange={e => onNoteChange(item.student_id, e.target.value)}
            onBlur={e => onNoteBlur(item.student_id, e.target.value)}
            rows={2}
            placeholder="Öğrenci hakkında kısa not..."
            className="w-full px-3 py-2 text-base border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>
      )}

      {/* Geçmiş paneli */}
      {historyOpenId === item.student_id && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-700">
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
                    <span className={log.old_status ? STYLE_TEXT[log.old_status as SubmissionStatus] : 'text-gray-400'}>
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
