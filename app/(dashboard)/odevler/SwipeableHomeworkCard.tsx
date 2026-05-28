'use client'

import { useState, useTransition } from 'react'
import { useSwipeable } from 'react-swipeable'
import Link from 'next/link'

interface SwipeableHomeworkCardProps {
  id: string
  title: string
  subject: string
  className: string
  dueDateStr: string
  overdue: boolean
  description?: string
  teacherName?: string
  canWrite: boolean
  checkedCount?: number
  totalStudents?: number
  isLocked?: boolean
  onDelete: () => unknown
}

export default function SwipeableHomeworkCard({
  id,
  title,
  subject,
  className,
  dueDateStr,
  overdue,
  description,
  teacherName,
  canWrite,
  checkedCount,
  totalStudents,
  isLocked,
  onDelete,
}: SwipeableHomeworkCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (e.dir === 'Left' && canWrite) {
        setSwiping(true)
        setOffset(Math.min(0, -e.absX))
      }
    },
    onSwipedLeft: () => {
      if (canWrite) {
        setShowConfirm(true)
      }
      setOffset(0)
      setSwiping(false)
    },
    onSwipedRight: () => {
      setOffset(0)
      setSwiping(false)
      setShowConfirm(false)
    },
    trackMouse: false,
    delta: 30,
  })

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Silme arkaplanı */}
      {canWrite && (
        <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
      )}

      {/* Kart içeriği */}
      <div
        {...handlers}
        style={{ transform: `translateX(${offset}px)`, transition: swiping ? 'none' : 'transform 0.2s ease' }}
        className="group bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
      >
        <div className={`h-0.5 ${overdue ? 'bg-red-400' : 'bg-emerald-400'}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <Link
              href={`/odevler/${id}`}
              className="font-semibold text-gray-900 dark:text-slate-100 hover:text-red-700 dark:hover:text-red-400 transition-colors leading-snug text-base"
            >
              {title}
            </Link>
            <span className={`shrink-0 inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${
              overdue
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${overdue ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {overdue ? 'Geçmiş' : 'Aktif'}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
              {className}
            </span>
            <span className="text-gray-300 dark:text-slate-600">·</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">{subject}</span>
          </div>

          {description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed">{description}</p>
          )}

          {/* Progress bar */}
          {typeof checkedCount === 'number' && typeof totalStudents === 'number' && totalStudents > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 dark:text-slate-500">Kontrol</span>
                <span className="text-xs font-semibold text-gray-600 dark:text-slate-300 tabular-nums">
                  {checkedCount}/{totalStudents}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    checkedCount === 0
                      ? 'w-0'
                      : checkedCount >= totalStudents
                        ? 'bg-emerald-500'
                        : checkedCount / totalStudents >= 0.5
                          ? 'bg-blue-500'
                          : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((checkedCount / totalStudents) * 100))}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-slate-700">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{dueDateStr}</span>
              </div>
              {teacherName && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{teacherName}</span>
                </div>
              )}
              {isLocked && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-md">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Kilitli
                </span>
              )}
            </div>
            <Link
              href={`/odevler/${id}`}
              className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors"
            >
              Detay
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Silme onay modal */}
      {showConfirm && canWrite && (
        <div className="absolute inset-0 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center p-4 z-10 border border-red-200 dark:border-red-900">
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">Ödevi sil?</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 line-clamp-1">&quot;{title}&quot;</p>
            <div className="flex items-center gap-2 justify-center">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors min-h-[44px]"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  startTransition(async () => { await onDelete() })
                }}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors min-h-[44px] disabled:opacity-50"
              >
                {isPending ? 'Siliniyor…' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
