import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { format, parseISO, addDays } from '@/src/shared/date'

export default async function MudurHaftaWidget() {
  const supabase   = await createClient()
  const school_id  = await requireSchoolId()

  const today     = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const next7Str  = addDays(today, 7).toISOString().split('T')[0]

  const [weekMeetingsRes, weekZumreRes] = await Promise.all([
    supabase.from('school_meetings').select('id, title, meeting_date')
      .eq('school_id', school_id).neq('meeting_type', 'not')
      .gte('meeting_date', todayStr).lte('meeting_date', next7Str),
    supabase.from('zumre_meetings').select('id, title, meeting_date, branch')
      .eq('school_id', school_id)
      .gte('meeting_date', todayStr).lte('meeting_date', next7Str),
  ])

  const weekMeetings = weekMeetingsRes.data ?? []
  const weekZumre    = weekZumreRes.data    ?? []

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 shrink-0">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bu Hafta</h2>
      </div>
      <div className="flex-1 divide-y divide-gray-100 dark:divide-slate-700 overflow-y-auto">
        {weekMeetings.length === 0 && weekZumre.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">Bu hafta planlanmış etkinlik yok.</p>
        ) : (
          <>
            {weekMeetings.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{m.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Okul Toplantısı · {format(parseISO(m.meeting_date), 'd MMMM')}
                  </p>
                </div>
              </div>
            ))}
            {weekZumre.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{m.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Zümre · {m.branch} · {format(parseISO(m.meeting_date), 'd MMMM')}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
