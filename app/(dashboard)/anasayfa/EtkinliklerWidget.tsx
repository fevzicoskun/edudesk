import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { format, parseISO, addDays, isToday, isSameDay } from '@/src/shared/date'

type Priority = 'önemli' | 'dikkat' | 'az_önemli'

const PRIORITY: Record<Priority, { label: string; badge: string; dot: string }> = {
  'önemli':    { label: 'Önemli',    badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',       dot: 'bg-red-500' },
  'dikkat':    { label: 'Dikkat',    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', dot: 'bg-amber-500' },
  'az_önemli': { label: 'Az Önemli', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',   dot: 'bg-slate-400' },
}

const TYPE_BADGE: Record<string, string> = {
  genel:              'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  veli:               'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ogretmenler_kurulu: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  diger:              'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  not:                'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  zumre:              'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
}

const TYPE_LABELS: Record<string, string> = {
  genel:              'Genel',
  veli:               'Veli',
  ogretmenler_kurulu: 'Öğr. Kurulu',
  diger:              'Diğer',
  not:                'Not',
  zumre:              'Zümre',
}

type Event = {
  id: string
  title: string
  date: string
  type: string
  priority: Priority | null
  sub?: string
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Bugün'
  if (isSameDay(d, addDays(new Date(), 1))) return 'Yarın'
  return format(d, 'd')
}

function groupByMonth(events: Event[]) {
  const map = new Map<string, Event[]>()
  for (const e of events) {
    const key = e.date.slice(0, 7) // "2026-05"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return format(d, 'MMMM yyyy')
}

export default async function EtkinliklerWidget() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()
  const today     = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const maxStr    = addDays(today, 60).toISOString().split('T')[0]

  const [schoolRes, zumreRes] = await Promise.all([
    supabase.from('school_meetings')
      .select('id, title, meeting_date, meeting_type, attendees')
      .eq('school_id', school_id)
      .gte('meeting_date', todayStr)
      .lte('meeting_date', maxStr)
      .order('meeting_date'),
    supabase.from('zumre_meetings')
      .select('id, title, meeting_date, branch')
      .eq('school_id', school_id)
      .gte('meeting_date', todayStr)
      .lte('meeting_date', maxStr)
      .order('meeting_date'),
  ])

  const events: Event[] = [
    ...(schoolRes.data ?? []).map(m => ({
      id:       m.id,
      title:    m.title,
      date:     m.meeting_date,
      type:     m.meeting_type ?? 'genel',
      priority: (m.attendees && m.attendees in PRIORITY ? m.attendees as Priority : null),
    })),
    ...(zumreRes.data ?? []).map(m => ({
      id:    m.id,
      title: m.title,
      date:  m.meeting_date,
      type:  'zumre',
      priority: null,
      sub:   m.branch ?? undefined,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const grouped = groupByMonth(events)

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col h-full min-h-[420px]">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Etkinlikler</h2>
        <span className="text-[10px] text-gray-400 dark:text-slate-500">Önümüzdeki 60 gün</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">Yaklaşan etkinlik yok.</p>
        ) : grouped.map(([monthKey, items]) => (
          <div key={monthKey}>
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-700/40 border-b border-gray-100 dark:border-slate-700 sticky top-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400">
                {monthLabel(monthKey)}
              </p>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {items.map(e => {
                const p = e.priority ? PRIORITY[e.priority] : null
                return (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    {/* Date chip */}
                    <div className="w-8 text-center shrink-0">
                      <p className="text-base font-bold leading-none text-gray-800 dark:text-slate-200">
                        {dayLabel(e.date) === 'Bugün' || dayLabel(e.date) === 'Yarın'
                          ? <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{dayLabel(e.date)}</span>
                          : dayLabel(e.date)
                        }
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                        {format(parseISO(e.date), 'EEE')}
                      </p>
                    </div>

                    {/* Divider line */}
                    <div className={`w-px h-8 shrink-0 rounded-full ${p ? p.dot : 'bg-gray-200 dark:bg-slate-600'}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{e.title}</p>
                      {e.sub && (
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{e.sub}</p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-1 shrink-0">
                      {p && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${p.badge}`}>
                          {p.label}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[e.type] ?? TYPE_BADGE.diger}`}>
                        {TYPE_LABELS[e.type] ?? e.type}
                      </span>
                    </div>
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
