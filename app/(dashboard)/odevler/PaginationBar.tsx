import Link from 'next/link'
import type { FilterParams } from './types'

function buildPageHref(p: FilterParams, newPage: number): string {
  const sp = new URLSearchParams()
  if (p.sinif)    sp.set('sinif', p.sinif)
  if (p.ders)     sp.set('ders', p.ders)
  if (p.ogretmen) sp.set('ogretmen', p.ogretmen)
  if (p.q)        sp.set('q', p.q)
  if (newPage > 1) sp.set('page', String(newPage))
  const qs = sp.toString()
  return qs ? `/odevler?${qs}` : '/odevler'
}

export default function PaginationBar({
  page,
  totalPages,
  totalCount,
  params,
}: {
  page: number
  totalPages: number
  totalCount: number
  params: FilterParams
}) {
  const btnBase = 'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors border'
  const btnActive = `${btnBase} border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700`
  const btnDisabled = `${btnBase} border-transparent text-gray-300 dark:text-slate-600 cursor-default`

  return (
    <div className="flex items-center justify-between mt-6 px-1">
      <span className="text-xs text-gray-400 dark:text-slate-500">
        Toplam {totalCount} ödev · Sayfa {page}/{totalPages}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildPageHref(params, page - 1)} className={btnActive}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Önceki
          </Link>
        ) : (
          <span className={btnDisabled}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Önceki
          </span>
        )}
        {page < totalPages ? (
          <Link href={buildPageHref(params, page + 1)} className={btnActive}>
            Sonraki
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <span className={btnDisabled}>
            Sonraki
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        )}
      </div>
    </div>
  )
}
