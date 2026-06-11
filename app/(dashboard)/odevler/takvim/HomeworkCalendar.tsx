'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { SCHOOL_YEAR_HOLIDAYS } from '@/src/shared/constants/holidays'

type HwItem = {
  id: string
  title: string
  subject: string | null
  due_date: string
  classes: { name: string } | null
}

const DAYS   = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const CLASS_COLORS = [
  'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-teal-100   text-teal-700   dark:bg-teal-900/40   dark:text-teal-300',
  'bg-pink-100   text-pink-700   dark:bg-pink-900/40   dark:text-pink-300',
  'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  'bg-cyan-100   text-cyan-700   dark:bg-cyan-900/40   dark:text-cyan-300',
  'bg-rose-100   text-rose-700   dark:bg-rose-900/40   dark:text-rose-300',
  'bg-lime-100   text-lime-700   dark:bg-lime-900/40   dark:text-lime-300',
]

function classColor(name: string | null | undefined): string {
  if (!name) return CLASS_COLORS[0]
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff
  return CLASS_COLORS[h % CLASS_COLORS.length]
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toISO(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }

function formatFull(dateStr: string) {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

export default function HomeworkCalendar({
  homeworks,
  completionMap = {},
}: {
  homeworks: HwItem[]
  completionMap?: Record<string, { yapildi: number; total: number }>
}) {
  const today = new Date()
  const todayStr = toISO(today.getFullYear(), today.getMonth(), today.getDate())

  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const holidayMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const h of SCHOOL_YEAR_HOLIDAYS) m.set(h.date, h.label)
    return m
  }, [])

  const hwMap = useMemo(() => {
    const m = new Map<string, HwItem[]>()
    for (const hw of homeworks) {
      if (!hw.due_date) continue
      const list = m.get(hw.due_date) ?? []
      m.set(hw.due_date, [...list, hw])
    }
    return m
  }, [homeworks])

  // Ay toplamları
  const hwCountByMonth = useMemo(() => {
    const m = new Map<string, number>()
    for (const hw of homeworks) {
      if (!hw.due_date) continue
      const key = hw.due_date.slice(0, 7) // "2026-04"
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [homeworks])

  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const goPrev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const goNext = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1) } else setMonth(m => m + 1) }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(todayStr) }

  const selectedHws     = selectedDay ? (hwMap.get(selectedDay) ?? []) : []
  const selectedHoliday = selectedDay ? holidayMap.get(selectedDay) : undefined
  const monthKey        = `${year}-${pad(month + 1)}`
  const monthHwCount    = hwCountByMonth.get(monthKey) ?? 0

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-0">

      {/* Takvim */}
      <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">

        {/* Ay navigasyonu */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <button
            onClick={goPrev}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <p className="text-base font-bold text-gray-900 dark:text-slate-100">
              {MONTHS[month]} {year}
            </p>
            {monthHwCount > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{monthHwCount} ödev</p>
            )}
          </div>

          <button
            onClick={goNext}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Gün başlıkları */}
        <div className="grid grid-cols-7 px-2 pt-3 pb-1">
          {DAYS.map((d, i) => (
            <div key={d} className={`text-center text-[11px] font-semibold pb-1 ${i >= 5 ? 'text-gray-300 dark:text-slate-600' : 'text-gray-400 dark:text-slate-500'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Günler */}
        <div className="grid grid-cols-7 gap-px px-2 pb-3">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="min-h-[72px] sm:min-h-[80px]" />

            const dateStr    = toISO(year, month, day)
            const dayHws     = hwMap.get(dateStr) ?? []
            const holiday    = holidayMap.get(dateStr)
            const isToday    = dateStr === todayStr
            const isSelected = dateStr === selectedDay
            const isWeekend  = (i % 7) >= 5
            const hasHws     = dayHws.length > 0
            const visibleHws = dayHws.slice(0, 2)
            const overflowN  = dayHws.length - 2

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(prev => prev === dateStr ? null : dateStr)}
                className={`min-h-[72px] sm:min-h-[80px] flex flex-col items-start p-1 rounded-xl transition-colors text-left ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {/* Gün numarası */}
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                  isToday
                    ? 'bg-blue-600 text-white'
                    : isWeekend
                      ? 'text-gray-300 dark:text-slate-600'
                      : 'text-gray-700 dark:text-slate-300'
                }`}>
                  {day}
                </span>

                {/* Tatil */}
                {holiday && (
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight line-clamp-1 px-0.5 mb-0.5">
                    {holiday}
                  </span>
                )}

                {/* Ödev pill'leri */}
                <div className="w-full space-y-0.5">
                  {visibleHws.map(hw => (
                    <div
                      key={hw.id}
                      className={`text-[10px] font-medium px-1 py-0.5 rounded-md leading-tight line-clamp-1 ${classColor(hw.classes?.name)}`}
                    >
                      {hw.classes?.name && <span className="font-bold mr-0.5">{hw.classes.name}</span>}
                      {hw.subject ?? hw.title}
                    </div>
                  ))}
                  {overflowN > 0 && (
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 px-1">
                      +{overflowN} daha
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Bugüne git */}
        <div className="px-4 pb-4 flex items-center justify-between">
          <button
            onClick={goToday}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Bugüne Git
          </button>
        </div>
      </div>

      {/* Sağ panel: seçili gün */}
      <div className="lg:w-72 xl:w-80 flex-shrink-0">
        {selectedDay ? (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden h-full">
            {/* Tarih başlığı */}
            <div className="px-4 py-4 border-b border-gray-100 dark:border-slate-700">
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight">
                {formatFull(selectedDay)}
              </p>
              {selectedHoliday && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {selectedHoliday}
                </p>
              )}
            </div>

            {/* Ödevler */}
            <div className="flex-1">
              {selectedHws.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-gray-400 dark:text-slate-500">Bu gün ödev yok.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50 dark:divide-slate-700/60">
                  {selectedHws.map(hw => (
                    <li key={hw.id}>
                      <Link
                        href={`/odevler/${hw.id}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group"
                      >
                        <span className={`mt-1 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${classColor(hw.classes?.name)}`}>
                          {hw.classes?.name ?? '—'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                            {hw.title}
                          </p>
                          {hw.subject && (
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{hw.subject}</p>
                          )}
                          {completionMap[hw.id] && completionMap[hw.id].total > 0 && (
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                              %{Math.round((completionMap[hw.id].yapildi / completionMap[hw.id].total) * 100)} tamamlandı
                              ({completionMap[hw.id].yapildi}/{completionMap[hw.id].total})
                            </p>
                          )}
                        </div>
                        <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Bu güne ödev ekle */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700">
              <Link
                href={`/odevler/yeni?tarih=${selectedDay}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Bu Güne Ödev Ekle
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm flex items-center justify-center p-8 text-center">
            <div>
              <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 dark:text-slate-500">Günü seçin</p>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
