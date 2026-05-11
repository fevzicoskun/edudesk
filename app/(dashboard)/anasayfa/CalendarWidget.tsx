'use client'

import { useState, useMemo } from 'react'

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

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function pad(n: number) { return String(n).padStart(2, '0') }
function toStr(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }

export default function CalendarWidget() {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const holidayMap = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>()
    for (const h of HOLIDAYS) {
      if (!map.has(h.date)) map.set(h.date, h)
    }
    return map
  }, [])

  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate())

  // First day of month (0=Sun … 6=Sat) → convert to Mon-based (0=Mon … 6=Sun)
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const monthHolidays = useMemo(() => {
    const seen = new Set<string>()
    return HOLIDAYS.filter(h => {
      const [y, m] = h.date.split('-').map(Number)
      if (y !== year || m !== month + 1) return false
      if (seen.has(h.label)) return false
      seen.add(h.label)
      return true
    })
  }, [year, month])

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Takvim</h2>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span className="text-xs font-medium text-gray-700 w-28 text-center">{MONTHS[month]} {year}</span>
          <button onClick={next} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 pb-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = toStr(year, month, day)
          const holiday = holidayMap.get(dateStr)
          const isToday = dateStr === todayStr
          return (
            <div key={i} className="flex flex-col items-center py-0.5">
              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium transition-colors
                ${isToday ? 'bg-blue-600 text-white' : holiday ? 'text-gray-900' : 'text-gray-600 hover:bg-gray-100'}
              `}>
                {day}
              </span>
              {holiday && (
                <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: holiday.color }} />
              )}
            </div>
          )
        })}
      </div>

      {/* This month's holidays */}
      {monthHolidays.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {monthHolidays.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
              <span className="text-xs text-gray-600 flex-1">{h.label}</span>
              <span className="text-[10px] text-gray-400 tabular-nums">{h.date.slice(8)} {MONTHS[month].slice(0,3)}</span>
            </div>
          ))}
        </div>
      )}

      {monthHolidays.length === 0 && (
        <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 text-center">Bu ayda resmi tatil yok</p>
      )}
    </section>
  )
}
