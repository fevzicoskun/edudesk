import type { SubmissionStatus } from '@/src/shared/types'
import { BULK_OPTIONS, LABELS, STYLES } from './types'

type Props = {
  isPending: boolean
  onBulkUpdate: (status: SubmissionStatus) => void
  onExportExcel: () => void
}

export default function StatusBoardToolbar({ isPending, onBulkUpdate, onExportExcel }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tümünü güncelle</p>
        <button
          onClick={onExportExcel}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-green-700 dark:hover:text-green-400 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-green-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Excel
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BULK_OPTIONS.map(option => (
          <button
            key={option}
            disabled={isPending}
            onClick={() => onBulkUpdate(option)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${STYLES[option]}`}
          >
            Tümü {LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  )
}
