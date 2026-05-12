'use client'

import { useMemo } from 'react'

const HOLIDAYS: { date: string; label: string; color: string }[] = [
  { date: '2025-01-01', label: 'Yılbaşı',            color: 'bg-sky-400' },
  { date: '2025-03-30', label: 'Ramazan Bayramı',    color: 'bg-emerald-400' },
  { date: '2025-03-31', label: 'Ramazan Bayramı',    color: 'bg-emerald-400' },
  { date: '2025-04-01', label: 'Ramazan Bayramı',    color: 'bg-emerald-400' },
  { date: '2025-04-23', label: 'Ulusal Egemenlik',   color: 'bg-red-400' },
  { date: '2025-05-01', label: 'Emek Bayramı',       color: 'bg-orange-400' },
  { date: '2025-05-19', label: 'Gençlik Bayramı',    color: 'bg-red-400' },
  { date: '2025-06-06', label: 'Kurban Bayramı',     color: 'bg-teal-400' },
  { date: '2025-06-07', label: 'Kurban Bayramı',     color: 'bg-teal-400' },
  { date: '2025-06-08', label: 'Kurban Bayramı',     color: 'bg-teal-400' },
  { date: '2025-06-09', label: 'Kurban Bayramı',     color: 'bg-teal-400' },
  { date: '2025-07-15', label: 'Demokrasi Bayramı',  color: 'bg-sky-400' },
  { date: '2025-08-30', label: 'Zafer Bayramı',      color: 'bg-red-400' },
  { date: '2025-10-29', label: 'Cumhuriyet Bayramı', color: 'bg-red-500' },
  { date: '2026-01-01', label: 'Yılbaşı',            color: 'bg-sky-400' },
  { date: '2026-03-20', label: 'Ramazan Bayramı',    color: 'bg-emerald-400' },
  { date: '2026-03-21', label: 'Ramazan Bayramı',    color: 'bg-emerald-400' },
  { date: '2026-03-22', label: 'Ramazan Bayramı',    color: 'bg-emerald-400' },
  { date: '2026-04-23', label: 'Ulusal Egemenlik',   color: 'bg-red-400' },
  { date: '2026-05-01', label: 'Emek Bayramı',       color: 'bg-orange-400' },
  { date: '2026-05-19', label: 'Gençlik Bayramı',    color: 'bg-red-400' },
  { date: '2026-05-27', label: 'Kurban Bayramı',     color: 'bg-teal-400' },
  { date: '2026-05-28', label: 'Kurban Bayramı',     color: 'bg-teal-400' },
  { date: '2026-05-29', label: 'Kurban Bayramı',     color: 'bg-teal-400' },
  { date: '2026-05-30', label: 'Kurban Bayramı',     color: 'bg-teal-400' },
  { date: '2026-07-15', label: 'Demokrasi Bayramı',  color: 'bg-sky-400' },
  { date: '2026-08-30', label: 'Zafer Bayramı',      color: 'bg-red-400' },
  { date: '2026-10-29', label: 'Cumhuriyet Bayramı', color: 'bg-red-500' },
]

function fmt(d: string) {
  const [, m, day] = d.split('-')
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  return `${parseInt(day)} ${months[parseInt(m) - 1]}`
}

export default function SidebarCalendar() {
  const today = new Date().toISOString().split('T')[0]

  const upcoming = useMemo(() => {
    const seen = new Set<string>()
    return HOLIDAYS.filter(h => {
      if (h.date < today) return false
      if (seen.has(h.label + h.date.slice(0, 7))) return false
      seen.add(h.label + h.date.slice(0, 7))
      return true
    }).slice(0, 4)
  }, [today])

  if (upcoming.length === 0) return null

  return (
    <div className="px-3 pb-3 border-t border-gray-100 dark:border-slate-700 pt-3">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
        Resmi Tatiller
      </p>
      <div className="space-y-1.5">
        {upcoming.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.color}`} />
            <span className="text-[11px] text-gray-600 dark:text-slate-400 truncate flex-1 leading-tight">{h.label}</span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 tabular-nums">{fmt(h.date)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
