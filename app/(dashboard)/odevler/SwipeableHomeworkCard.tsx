'use client'

import { useState, useTransition, useEffect } from 'react'
import { useSwipeable } from 'react-swipeable'
import Link from 'next/link'
import { useBulk } from './BulkContext'

type StatusCounts = { yapildi: number; eksik: number; yapilmadi: number; gec: number; mazeretli: number }

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

  const bulk = useBulk()
  const isSelected = bulk?.bulkMode && bulk.selected.has(id)

  if (isDeleted) return null

  // Bulk select mode: simplified card with checkbox.
  // Başkasının ödevi seçilemez — silinemeyecek bir ödevi seçtirmek sessiz kayba yol açıyordu.
  if (bulk?.bulkMode) {
    return (
      <div
        onClick={() => { if (canWrite) bulk.toggle(id) }}
        aria-disabled={!canWrite}
        title={canWrite ? undefined : 'Bu ödev size ait değil — yalnızca görüntüleyebilirsiniz'}
        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
          !canWrite
            ? 'bg-gray-50 dark:bg-slate-900 opacity-60 cursor-not-allowed'
            : isSelected
              ? 'bg-blue-50 dark:bg-blue-950/30 cursor-pointer'
              : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer'
        }`}
      >
        {canWrite ? (
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
            isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-slate-600'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        ) : (
          <svg className="w-4 h-4 shrink-0 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
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

  // Kaç öğrencinin yaptığı — hiç işaretlenmemişse boş (aktif ödevde henüz söyleyecek bir şey yok)
  const ilerleme = entered === 0 ? null
    : allEntered ? `${statusCounts?.yapildi ?? 0}/${totalStu} yaptı`
    : `${statusCounts?.yapildi ?? 0}/${totalStu} yaptı · ${unrecorded} girilmedi`

  return (
    <div className="relative overflow-hidden">
      {/* Sağa swipe: detay arkaplanı */}
      <div className={`absolute inset-0 bg-blue-500 flex items-center pl-6 transition-opacity duration-150 ${swipeDir === 'right' ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-white text-sm font-semibold">Detay →</span>
      </div>

      {/* Sola swipe: silme arkaplanı */}
      {canWrite && swipeDir === 'left' && (
        <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6">
          <span className="text-white text-sm font-semibold">Sil</span>
        </div>
      )}

      {/* Satır — başlık bağlantısı tüm satırı kaplar (after:inset-0), sil düğmesi üstte kalır */}
      <div
        {...handlers}
        style={{ transform: `translateX(${offset}px)`, transition: swiping ? 'none' : 'transform 0.2s ease' }}
        className="group relative flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <Link
            href={`/odevler/${id}`}
            className="block truncate text-sm font-medium text-gray-900 dark:text-slate-100 after:absolute after:inset-0"
          >
            {title}
          </Link>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400 truncate">
            {className} · {subject} · {dueDateStr}
            {teacherName && ` · ${teacherName}`}
            {ilerleme && <span className={allEntered ? 'text-emerald-700 dark:text-emerald-400' : ''}> · {ilerleme}</span>}
          </p>
        </div>
        {/* Yalnız yaklaşan teslimde rozet — "Aktif" rozeti bu bölümde bilgi taşımıyordu */}
        {!overdue && badge.text !== 'Aktif' && (
          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.text}
          </span>
        )}
        {canWrite && (
          <button
            onClick={() => setShowConfirm(true)}
            aria-label={`"${title}" ödevini sil`}
            title="Sil (mobilde sola kaydır)"
            className="relative z-10 shrink-0 p-1 hidden sm:block opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
        <svg className="w-4 h-4 shrink-0 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Silme onay modal */}
      {showConfirm && canWrite && (
        <div className="absolute inset-0 bg-white dark:bg-slate-800 flex items-center justify-between gap-3 px-4 z-20">
          <p className="min-w-0 truncate text-sm font-semibold text-gray-800 dark:text-slate-200">&quot;{title}&quot; silinsin mi?</p>
            <div className="flex items-center gap-2 shrink-0">
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
      )}
      {deleteError && (
        <div className="absolute bottom-3 left-3 right-3 z-20 bg-red-600 text-white text-xs font-medium px-3 py-2 rounded-lg text-center">
          {deleteError}
        </div>
      )}
    </div>
  )
}
