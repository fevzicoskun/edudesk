'use client'

import { useState, useTransition, useRef } from 'react'
import { createMeeting, deleteMeeting } from '@/src/domains/school/actions/meetings'
import { format, parseISO, isToday, isSameDay, addDays } from '@/src/shared/date'

type Meeting = {
  id: string
  title: string
  meeting_date: string
  meeting_type: string
  attendees: string | null  // öncelik: 'önemli' | 'dikkat' | 'az_önemli' | null
  notes: string | null
}

type Priority = 'önemli' | 'dikkat' | 'az_önemli'

const PRIORITY: Record<Priority, { label: string; dot: string; badge: string; borderColor: string }> = {
  'önemli':    { label: 'Önemli',    dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',       borderColor: 'border-l-red-500' },
  'dikkat':    { label: 'Dikkat',    dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', borderColor: 'border-l-amber-500' },
  'az_önemli': { label: 'Az Önemli', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',   borderColor: 'border-l-slate-400' },
}

const TYPE_LABELS: Record<string, string> = {
  genel:              'Genel',
  veli:               'Veli',
  ogretmenler_kurulu: 'Öğr. Kurulu',
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

export default function GundemClient({ initial, past = [] }: { initial: Meeting[]; past?: Meeting[] }) {
  const [meetings, setMeetings] = useState<Meeting[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedPriority, setSelectedPriority] = useState<Priority | ''>('')
  const [, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const todayStr = new Date().toISOString().split('T')[0]
  const grouped = groupByDate(meetings.filter(m => m.meeting_date >= todayStr))

  const handleAdd = (fd: FormData) => {
    startTransition(async () => {
      const res = await createMeeting(null, fd)
      if (res.success && res.id) {
        setMeetings(prev => [...prev, {
          id:           res.id!,
          title:        String(fd.get('title')),
          meeting_date: String(fd.get('meeting_date')),
          meeting_type: String(fd.get('meeting_type') ?? 'genel'),
          attendees:    String(fd.get('attendees') ?? '') || null,
          notes:        String(fd.get('notes') ?? '') || null,
        }].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)))
        formRef.current?.reset()
        setSelectedPriority('')
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
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
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

      {/* Form */}
      {showForm && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40 shrink-0">
          <form ref={formRef} action={handleAdd} className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Tarih</label>
                <input
                  type="date"
                  name="meeting_date"
                  required
                  defaultValue={todayStr}
                  className="px-2.5 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[6rem] sm:min-w-[8rem]">
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Başlık</label>
                <input
                  name="title"
                  required
                  minLength={2}
                  placeholder="Başlık…"
                  className="w-full px-2.5 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Tür</label>
                <select
                  name="meeting_type"
                  defaultValue="genel"
                  className="px-2.5 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="genel">Genel</option>
                  <option value="veli">Veli Toplantısı</option>
                  <option value="ogretmenler_kurulu">Öğretmenler Kurulu</option>
                  <option value="not">Not</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Önem</label>
              <input type="hidden" name="attendees" value={selectedPriority} />
              <div className="flex gap-1.5 flex-wrap">
                {(['önemli', 'dikkat', 'az_önemli'] as Priority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPriority(prev => prev === p ? '' : p)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                      selectedPriority === p
                        ? `${PRIORITY[p].badge} border-transparent`
                        : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY[p].dot}`} />
                    {PRIORITY[p].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Not <span className="normal-case font-normal">(isteğe bağlı)</span>
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Ek notlar…"
                className="w-full px-2.5 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-1.5">
              <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setSelectedPriority('') }}
                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
        {grouped.length === 0 ? (
          past.length > 0 ? (
            <div className="px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-3">
                Son Toplantılar
              </p>
              <ul className="space-y-1.5">
                {past.map(m => (
                  <li key={m.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-slate-700/30 opacity-60">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 w-14 tabular-nums">
                      {format(parseISO(m.meeting_date), 'd MMM')}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-slate-400 truncate">{m.title}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[m.meeting_type] ?? TYPE_BADGE.diger}`}>
                      {TYPE_LABELS[m.meeting_type] ?? m.meeting_type}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-3 text-center">Yaklaşan etkinlik yok.</p>
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">Yaklaşan etkinlik yok.</p>
          )
        ) : grouped.map(([dateStr, items]) => (
          <div key={dateStr} className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">
              {dateLabel(dateStr)}
            </p>
            <ul className="space-y-1.5">
              {items.map(m => {
                const priority = (m.attendees && m.attendees in PRIORITY) ? m.attendees as Priority : null
                const p = priority ? PRIORITY[priority] : null
                const isExpanded = expandedId === m.id
                return (
                  <li
                    key={m.id}
                    className={`rounded-lg border-l-2 overflow-hidden ${p ? p.borderColor : 'border-l-transparent'} bg-gray-50 dark:bg-slate-700/30`}
                  >
                    <div
                      className="group flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/60 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    >
                      {p && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${p.badge}`}>
                          {p.label}
                        </span>
                      )}
                      <span className="text-xs font-medium text-gray-800 dark:text-slate-200 flex-1 truncate">{m.title}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[m.meeting_type] ?? TYPE_BADGE.diger}`}>
                        {TYPE_LABELS[m.meeting_type] ?? m.meeting_type}
                      </span>
                      <svg
                        className={`w-3 h-3 text-gray-400 dark:text-slate-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(m.id) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-600 shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-2.5 pt-1.5 border-t border-gray-100 dark:border-slate-700">
                        {m.notes ? (
                          <p className="text-xs text-gray-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{m.notes}</p>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-slate-500 italic">Not eklenmemiş.</p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
