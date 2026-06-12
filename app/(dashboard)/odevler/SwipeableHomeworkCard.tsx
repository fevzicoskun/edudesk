'use client'

import { useState, useTransition, useEffect } from 'react'
import { useSwipeable } from 'react-swipeable'
import Link from 'next/link'
import { useBulk } from './BulkContext'

type StatusCounts = { yapildi: number; eksik: number; yapilmadi: number; gec: number; mazeretli: number }

const CHIP_STYLES: Record<keyof StatusCounts, string> = {
  yapildi:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  yapilmadi: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  eksik:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  gec:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  mazeretli: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

const CHIP_LABELS: Record<keyof StatusCounts, string> = {
  yapildi:   'Yapıldı',
  yapilmadi: 'Yapılmadı',
  eksik:     'Eksik',
  gec:       'Geç',
  mazeretli: 'Mazeretli',
}

const CHIP_ORDER: (keyof StatusCounts)[] = ['yapildi', 'yapilmadi', 'eksik', 'gec', 'mazeretli']

function getActiveBadge(dueDate?: string | null): { text: string; cls: string; dot: string } {
  if (!dueDate) return { text: 'Aktif', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' }
  const todayStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const days = Math.round(
    (new Date(dueDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86_400_000
  )
  if (days === 0) return { text: 'Bugün!', cls: 'bg-red-50 text-red-600 border-red-200',    dot: 'bg-red-500'     }
  if (days === 1) return { text: 'Yarın',  cls: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500' }
  if (days <= 3)  return { text: `${days} gün`, cls: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' }
  return { text: 'Aktif', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' }
}

interface SwipeableHomeworkCardProps {
  id: string
  title: string
  subject: string
  className: string
  dueDateStr: string
  dueDate?: string | null
  overdue: boolean
  description?: string
  teacherName?: string
  canWrite: boolean
  statusCounts?: StatusCounts
  totalStudents?: number
  onDelete: () => Promise<{ error?: string } | void>
}

export default function SwipeableHomeworkCard({
  id,
  title,
  subject,
  className,
  dueDateStr,
  dueDate,
  overdue,
  description,
  teacherName,
  canWrite,
  statusCounts,
  totalStudents,
  onDelete,
}: SwipeableHomeworkCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleted, setIsDeleted] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!deleteError) return
    const t = setTimeout(() => setDeleteError(null), 3500)
    return () => clearTimeout(t)
  }, [deleteError])

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (e.dir === 'Left' && canWrite) {
        setSwiping(true)
        setSwipeDir('left')
        setOffset(Math.min(0, -e.absX))
      } else if (e.dir === 'Right') {
        setSwiping(true)
        setSwipeDir('right')
        setOffset(Math.max(0, e.absX * 0.3))
      }
    },
    onSwipedLeft: () => {
      if (canWrite) setShowConfirm(true)
      setOffset(0)
      setSwiping(false)
      setSwipeDir(null)
    },
    onSwipedRight: () => {
      setOffset(0)
      setSwiping(false)
      setSwipeDir(null)
      setShowConfirm(false)
    },
    trackMouse: false,
    delta: 30,
  })

  const badge = overdue
    ? { text: 'Geçmiş', cls: 'bg-red-50 text-red-600 border-red-100', dot: 'bg-red-500' }
    : getActiveBadge(dueDate)

  const entered      = statusCounts ? Object.values(statusCounts).reduce((a, b) => a + b, 0) : 0
  const totalStu     = typeof totalStudents === 'number' ? totalStudents : 0
  const unrecorded   = totalStu - entered
  const allEntered   = totalStu > 0 && entered > 0 && unrecorded === 0
  const showChips    = totalStu > 0 && (entered > 0 || (overdue && unrecorded > 0))

  const bulk = useBulk()
  const isSelected = bulk?.bulkMode && bulk.selected.has(id)

  if (isDeleted) return null

  // Bulk select mode: simplified card with checkbox
  if (bulk?.bulkMode) {
    return (
      <div
        onClick={() => bulk.toggle(id)}
        className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-600'
            : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'
        }`}
      >
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-slate-600'
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{title}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{className} · {subject} · {dueDateStr}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
          {badge.text}
        </span>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Sağa swipe: detay arkaplanı */}
      <div className={`absolute inset-0 bg-blue-500 flex items-center pl-6 rounded-2xl transition-opacity duration-150 ${swipeDir === 'right' ? 'opacity-100' : 'opacity-0'}`}>
        <svg className="w-5 h-5 text-white mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-white text-sm font-semibold">Detay</span>
      </div>

      {/* Sola swipe: silme arkaplanı */}
      {canWrite && (
        <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl">
          <span className="text-white text-sm font-semibold mr-2">Sil</span>
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
            <span className={`shrink-0 inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${badge.dot}`} />
              {badge.text}
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

          {/* Durum chip satırı */}
          {showChips && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {allEntered ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  ✓ Tümü girildi ({totalStu} öğrenci)
                </span>
              ) : (
                <>
                  {CHIP_ORDER.map(key => {
                    const count = statusCounts?.[key] ?? 0
                    if (count === 0) return null
                    return (
                      <span key={key} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CHIP_STYLES[key]}`}>
                        {count} {CHIP_LABELS[key]}
                      </span>
                    )
                  })}
                  {unrecorded > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500">
                      {unrecorded} girilmedi
                    </span>
                  )}
                </>
              )}
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
            </div>
            <div className="flex items-center gap-3">
              {canWrite && (
                <button
                  onClick={() => setShowConfirm(true)}
                  aria-label="Ödevi sil"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
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
                  setDeleteError(null)
                  setIsDeleted(true)
                  startTransition(async () => {
                    const result = await onDelete()
                    if (result && 'error' in result && result.error) {
                      setIsDeleted(false)
                      setDeleteError(result.error)
                    }
                  })
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
      {deleteError && (
        <div className="absolute bottom-3 left-3 right-3 z-20 bg-red-600 text-white text-xs font-medium px-3 py-2 rounded-lg text-center">
          {deleteError}
        </div>
      )}
    </div>
  )
}
