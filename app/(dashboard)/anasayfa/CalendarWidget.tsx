'use client'

import { useState, useMemo } from 'react'

type HwLite = {
  id: string
  title: string
  subject: string
  due_date: string
  classes: { name: string; grade: number } | null
}

const HOLIDAYS: { date: string; label: string; color: string }[] = [
  { date: '2025-01-01', label: 'Yılbaşı',            color: '#38bdf8' },
  { date: '2025-03-30', label: 'Ramazan Bayramı',    color: '#34d399' },
  { date: '2025-03-31', label: 'Ramazan Bayramı',    color: '#34d399' },
  { date: '2025-04-01', label: 'Ramazan Bayramı',    color: '#34d399' },
  { date: '2025-04-23', label: 'Ulusal Egemenlik',   color: '#f87171' },
  { date: '2025-05-01', label: 'Emek Bayramı',       color: '#fb923c' },
  { date: '2025-05-19', label: 'Gençlik Bayramı',    color: '#f87171' },
  { date: '2025-06-06', label: 'Kurban Bayramı',     color: '#2dd4bf' },
  { date: '2025-06-07', label: 'Kurban Bayramı',     color: '#2dd4bf' },
  { date: '2025-06-08', label: 'Kurban Bayramı',     color: '#2dd4bf' },
  { date: '2025-06-09', label: 'Kurban Bayramı',     color: '#2dd4bf' },
  { date: '2025-07-15', label: 'Demokrasi Bayramı',  color: '#38bdf8' },
  { date: '2025-08-30', label: 'Zafer Bayramı',      color: '#f87171' },
  { date: '2025-10-29', label: 'Cumhuriyet Bayramı', color: '#f43f5e' },
  { date: '2026-01-01', label: 'Yılbaşı',            color: '#38bdf8' },
  { date: '2026-03-20', label: 'Ramazan Bayramı',    color: '#34d399' },
  { date: '2026-03-21', label: 'Ramazan Bayramı',    color: '#34d399' },
  { date: '2026-03-22', label: 'Ramazan Bayramı',    color: '#34d399' },
  { date: '2026-04-23', label: 'Ulusal Egemenlik',   color: '#f87171' },
  { date: '2026-05-01', label: 'Emek Bayramı',       color: '#fb923c' },
  { date: '2026-05-19', label: 'Gençlik Bayramı',    color: '#f87171' },
  { date: '2026-05-27', label: 'Kurban Bayramı',     color: '#2dd4bf' },
  { date: '2026-05-28', label: 'Kurban Bayramı',     color: '#2dd4bf' },
  { date: '2026-05-29', label: 'Kurban Bayramı',     color: '#2dd4bf' },
  { date: '2026-05-30', label: 'Kurban Bayramı',     color: '#2dd4bf' },
  { date: '2026-07-15', label: 'Demokrasi Bayramı',  color: '#38bdf8' },
  { date: '2026-08-30', label: 'Zafer Bayramı',      color: '#f87171' },
  { date: '2026-10-29', label: 'Cumhuriyet Bayramı', color: '#f43f5e' },
]

const DAYS   = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function pad(n: number) { return String(n).padStart(2, '0') }
function toStr(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }

export default function CalendarWidget({ homeworks = [] }: { homeworks?: HwLite[] }) {
  const today = new Date()
  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate())

  const holidayMap = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>()
    for (const h of HOLIDAYS) {
      if (!map.has(h.date)) map.set(h.date, h)
    }
    return map
  }, [])

  const hwMap = useMemo(() => {
    const map = new Map<string, HwLite[]>()
    for (const hw of homeworks) {
      if (!hw.due_date) continue
      const list = map.get(hw.due_date) ?? []
      map.set(hw.due_date, [...list, hw])
    }
    return map
  }, [homeworks])

  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1) } else setMonth(m => m + 1) }

  const selectedHoliday = selectedDay ? holidayMap.get(selectedDay) : undefined
  const selectedHws     = selectedDay ? (hwMap.get(selectedDay) ?? []) : []
  const hasSelectedData = !!(selectedHoliday || selectedHws.length > 0)

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Takvim</h2>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300 w-28 text-center">{MONTHS[month]} {year}</span>
          <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      {/* Gün başlıkları */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 pb-0.5">{d}</div>
        ))}
      </div>

      {/* Gün hücreleri */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr    = toStr(year, month, day)
          const holiday    = holidayMap.get(dateStr)
          const dayHws     = hwMap.get(dateStr)
          const isToday    = dateStr === todayStr
          const isSelected = dateStr === selectedDay

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(prev => prev === dateStr ? null : dateStr)}
              className="flex flex-col items-center py-0.5 rounded transition-colors"
            >
              <span className={`
                w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-medium transition-colors
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-800' : ''}
                ${isToday
                  ? 'bg-blue-600 text-white'
                  : holiday
                    ? 'text-gray-900 dark:text-slate-100'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}
              `}>
                {day}
              </span>
              {(holiday || dayHws) && (
                <div className="flex gap-0.5 mt-0.5">
                  {holiday && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: holiday.color }} />}
                  {dayHws  && <span className="w-1 h-1 rounded-full bg-blue-400" />}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Seçili gün detayı */}
      {hasSelectedData && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1.5">
          {selectedHoliday && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedHoliday.color }} />
              <span className="text-xs text-gray-600 dark:text-slate-400 flex-1">{selectedHoliday.label}</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 tabular-nums">
                {selectedDay!.slice(8)} {MONTHS[month].slice(0, 3)}
              </span>
            </div>
          )}
          {selectedHws.map(hw => (
            <div key={hw.id} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">{hw.title}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">{hw.classes?.name ?? '—'} · {hw.subject}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
