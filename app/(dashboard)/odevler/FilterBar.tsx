'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useState, useEffect, useRef } from 'react'

type ClassItem = { id: string; name: string; grade: number }
type TeacherItem = { id: string; full_name: string }

type FilterParams = {
  sinif?: string
  ders?: string
  ogretmen?: string
  q?: string
}

const selectCls =
  'px-3 py-2 bg-white border border-gray-200 rounded-xl text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 hover:border-gray-300 transition-all cursor-pointer'

export default function OdevlerFilterBar({
  classes,
  subjects,
  teachers,
  currentParams,
}: {
  classes: ClassItem[]
  subjects: string[]
  teachers: TeacherItem[]
  currentParams: FilterParams
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [localQ, setLocalQ] = useState(currentParams.q ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const paramsRef = useRef(currentParams)
  paramsRef.current = currentParams
  const localQRef = useRef(localQ)
  localQRef.current = localQ

  // Sync search box when q cleared externally (e.g. Temizle button)
  useEffect(() => {
    setLocalQ(currentParams.q ?? '')
  }, [currentParams.q])

  // Debounced search: wait 400ms after last keystroke before navigating
  useEffect(() => {
    const p = paramsRef.current
    if (localQ === (p.q ?? '')) return
    const timer = setTimeout(() => {
      const pr = paramsRef.current
      const current: Record<string, string> = {}
      if (pr.sinif) current.sinif = pr.sinif
      if (pr.ders) current.ders = pr.ders
      if (pr.ogretmen) current.ogretmen = pr.ogretmen
      if (localQ) current.q = localQ
      const qs = new URLSearchParams(current).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    }, 400)
    return () => clearTimeout(timer)
  }, [localQ, router, pathname])

  const update = useCallback(
    (key: string, value: string) => {
      const p = paramsRef.current
      const current: Record<string, string> = {}
      if (p.sinif) current.sinif = p.sinif
      if (p.ders) current.ders = p.ders
      if (p.ogretmen) current.ogretmen = p.ogretmen
      if (localQRef.current) current.q = localQRef.current

      if (value) {
        current[key] = value
      } else {
        delete current[key]
      }

      const params = new URLSearchParams(current)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname]
  )

  const activeFilterCount = [
    currentParams.sinif,
    currentParams.ders,
    currentParams.ogretmen,
  ].filter(Boolean).length

  const hasFilters = activeFilterCount > 0 || !!currentParams.q

  const filterPanel = (
    <div className="flex flex-wrap gap-2 items-center">
      <select
        value={currentParams.sinif ?? ''}
        onChange={(e) => update('sinif', e.target.value)}
        className={selectCls}
      >
        <option value="">Tüm sınıflar</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        value={currentParams.ders ?? ''}
        onChange={(e) => update('ders', e.target.value)}
        className={selectCls}
      >
        <option value="">Tüm dersler</option>
        {subjects.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {teachers.length > 0 && (
        <select
          value={currentParams.ogretmen ?? ''}
          onChange={(e) => update('ogretmen', e.target.value)}
          className={selectCls}
        >
          <option value="">Tüm öğretmenler</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={() => { router.replace(pathname); setShowFilters(false) }}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-2 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Temizle
        </button>
      )}
    </div>
  )

  return (
    <div className="mb-5 space-y-2">
      {/* Arama + mobil toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Ödev ara..."
            value={localQ}
            onChange={e => setLocalQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 hover:border-gray-300 transition-all"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          className={`sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
            activeFilterCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : showFilters
                ? 'bg-gray-100 border-gray-300 text-gray-700'
                : 'bg-white border-gray-200 text-gray-500'
          }`}
          aria-label="Filtreleri aç/kapat"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          {activeFilterCount > 0 ? activeFilterCount : 'Filtre'}
        </button>
      </div>

      {/* Filtreler — masaüstünde her zaman, mobilde toggle ile */}
      <div className={`sm:block ${showFilters ? 'block' : 'hidden'}`}>
        {filterPanel}
      </div>
    </div>
  )
}
