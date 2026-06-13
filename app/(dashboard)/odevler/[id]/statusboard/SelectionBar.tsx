'use client'

import type { SubmissionStatus } from '@/src/shared/types'
import { BULK_OPTIONS, LABELS, STYLES } from './types'

export default function SelectionBar({
  show, selectedCount, filteredCount, isPending, onSelectAll, onSetStatus, onCancel,
}: {
  show: boolean
  selectedCount: number
  filteredCount: number
  isPending: boolean
  onSelectAll: () => void
  onSetStatus: (status: SubmissionStatus) => void
  onCancel: () => void
}) {
  if (!show) return null
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl px-4 py-3 flex-wrap justify-center">
      <button
        onClick={onSelectAll}
        className="text-xs text-gray-300 hover:text-white transition-colors whitespace-nowrap"
      >
        {selectedCount === filteredCount ? 'Seçimi Temizle' : 'Tümünü Seç'}
      </button>
      <span className="text-sm font-medium whitespace-nowrap">{selectedCount} seçildi</span>
      {BULK_OPTIONS.map(status => (
        <button
          key={status}
          disabled={isPending}
          onClick={() => onSetStatus(status)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${STYLES[status]}`}
        >
          {LABELS[status]}
        </button>
      ))}
      <button onClick={onCancel} className="text-xs text-gray-400 hover:text-white transition-colors">
        İptal
      </button>
    </div>
  )
}
