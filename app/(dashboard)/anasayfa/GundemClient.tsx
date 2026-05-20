'use client'

import { useState, useTransition, useRef } from 'react'
import { createMeeting, deleteMeeting } from '@/src/domains/school/actions/meetings'
import { format, parseISO, isToday, isSameDay, addDays } from '@/src/shared/date'

type Meeting = {
  id: string
  title: string
  meeting_date: string
  meeting_type: string
  attendees: string | null
  notes: string | null
}

const TYPE_LABELS: Record<string, string> = {
  genel:              'Genel',
  veli:               'Veli',
  ogretmenler_kurulu: 'Öğretmenler K.',
  diger:              'Diğer',
  not:                'Not',
}

const TYPE_BADGE: Record<string, string> = {
  genel:              'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  veli:               'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ogretmenler_kurulu: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  diger:              'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  not:                'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

function groupByDate(meetings: Meeting[]) {
  const map = new Map<string, Meeting[]>()
  for (const m of meetings) {
    if (!map.has(m.meeting_date)) map.set(m.meeting_date, [])
    map.get(m.meeting_date)!.push(m)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

function dateLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Bugün'
  if (isSameDay(d, addDays(new Date(), 1))) return 'Yarın'
  return format(d, 'd MMMM EEEE')
}

export default function GundemClient({ initial }: { initial: Meeting[] }) {
  const [meetings, setMeetings] = useState<Meeting[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const todayStr = new Date().toISOString().split('T')[0]
  const grouped = groupByDate(meetings.filter(m => m.meeting_date >= todayStr))

  const handleAdd = (fd: FormData) => {
    startTransition(async () => {
      const res = await createMeeting(null, fd)
      if (res.success && res.id) {
        const id = res.id
        setMeetings(prev => [...prev, {
          id,
          title:        String(fd.get('title')),
          meeting_date: String(fd.get('meeting_date')),
          meeting_type: String(fd.get('meeting_type') ?? 'genel'),
          attendees: null,
          notes: null,
        }].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)))
        formRef.current?.reset()
        setShowForm(false)
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteMeeting(id)
      if (res.success) setMeetings(prev => prev.filter(m => m.id !== id))
    })
  }

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Gündem</h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Ekle
        </button>
      </div>

      {showForm && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40 shrink-0">
          <form ref={formRef} action={handleAdd} className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Tarih</label>
              <input
                type="date"
                name="meeting_date"
                required
                defaultValue={todayStr}
                className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[8rem]">
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Başlık</label>
              <input
                name="title"
                required
                minLength={2}
                placeholder="Etkinlik başlığı…"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Tür</label>
              <select
                name="meeting_type"
                defaultValue="genel"
                className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="genel">Genel</option>
                <option value="veli">Veli Toplantısı</option>
                <option value="ogretmenler_kurulu">Öğretmenler Kurulu</option>
                <option value="not">Not</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
            <div className="flex gap-1.5">
              <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Kaydet
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50" style={{ maxHeight: '340px' }}>
        {grouped.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">Yaklaşan etkinlik yok.</p>
        ) : grouped.map(([dateStr, items]) => (
          <div key={dateStr} className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">
              {dateLabel(dateStr)}
            </p>
            <ul className="space-y-1.5">
              {items.map(m => (
                <li key={m.id} className="group flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[m.meeting_type] ?? TYPE_BADGE.diger}`}>
                    {TYPE_LABELS[m.meeting_type] ?? m.meeting_type}
                  </span>
                  <span className="text-xs text-gray-800 dark:text-slate-200 flex-1 truncate">{m.title}</span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-600 shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
