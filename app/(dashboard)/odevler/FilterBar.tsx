'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useState, useEffect, useRef } from 'react'

type ClassItem = { id: string; name: string; grade: number }
type TeacherItem = { id: string; full_name: string }

type FilterParams = {
  sinif?: string
  baslangic?: string
  bitis?: string
  ders?: string
  durum?: string
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
      if (pr.baslangic) current.baslangic = pr.baslangic
      if (pr.bitis) current.bitis = pr.bitis
      if (pr.ders) current.ders = pr.ders
      if (pr.durum) current.durum = pr.durum
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
      if (p.baslangic) current.baslangic = p.baslangic
      if (p.bitis) current.bitis = p.bitis
      if (p.ders) current.ders = p.ders
      if (p.durum) current.durum = p.durum
      if (p.ogretmen) current.ogretmen = p.ogretmen
      // use latest localQ (may not be pushed to URL yet)
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

  const hasFilters =
    currentParams.sinif ||
    currentParams.baslangic ||
    currentParams.bitis ||
    currentParams.ders ||
    currentParams.durum ||
    currentParams.ogretmen ||
    currentParams.q

  return (
    <div className="mb-5 space-y-2.5">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Ödev başlığında ara..."
          value={localQ}
          onChange={e => setLocalQ(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 hover:border-gray-300 transition-all"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Filter icon with tooltip */}
        <div className="relative group">
          <div className="flex items-center justify-center w-9 h-9 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all cursor-default">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </div>
          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            Filtrele
          </span>
        </div>

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

        <select
          value={currentParams.durum ?? ''}
          onChange={(e) => update('durum', e.target.value)}
          className={selectCls}
        >
          <option value="">Tüm durumlar</option>
          <option value="yapildi">Yapıldı</option>
          <option value="eksik">Eksik</option>
          <option value="yapilmadi">Yapılmadı</option>
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
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
        <input
          type="date"
          value={currentParams.baslangic ?? ''}
          onChange={(e) => update('baslangic', e.target.value)}
          className={`${selectCls} w-full sm:w-auto`}
        />
        <span className="hidden sm:block text-sm text-gray-300">—</span>
        <input
          type="date"
          value={currentParams.bitis ?? ''}
          onChange={(e) => update('bitis', e.target.value)}
          className={`${selectCls} w-full sm:w-auto`}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => router.replace(pathname)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-2 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Temizle
          </button>
        )}
      </div>
    </div>
  )
}
