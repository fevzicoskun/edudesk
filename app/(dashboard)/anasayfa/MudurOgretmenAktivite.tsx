import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays, format } from '@/src/shared/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function MudurOgretmenAktivite() {
  const supabase   = await createClient()
  const school_id  = await requireSchoolId()
  const twoWeeksAgo = subDays(new Date(), 14).toISOString()

  const [profilesRes, sessionsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, subject, role')
      .eq('school_id', school_id)
      .in('role', ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi']),
    supabase.from('user_sessions').select('user_id, last_seen_at')
      .eq('school_id', school_id),
  ])

  const teachers = profilesRes.data ?? []
  const sessions = sessionsRes.data ?? []

  const lastSeenMap = new Map<string, string>()
  for (const s of sessions) {
    const prev = lastSeenMap.get(s.user_id)
    if (!prev || s.last_seen_at > prev) lastSeenMap.set(s.user_id, s.last_seen_at)
  }

  const withActivity = teachers
    .map(t => ({ ...t, lastSeen: lastSeenMap.get(t.id) ?? null }))
    .sort((a, b) => {
      if (!a.lastSeen && !b.lastSeen) return 0
      if (!a.lastSeen) return 1
      if (!b.lastSeen) return -1
      return b.lastSeen.localeCompare(a.lastSeen)
    })
    .slice(0, 8)

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm h-full">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Öğretmen Aktivitesi
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-100 dark:divide-slate-700">
          {withActivity.map(t => {
            const isActive = t.lastSeen && t.lastSeen >= twoWeeksAgo
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {t.full_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                    {t.subject ?? '—'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                  }`}>
                    {isActive ? 'Aktif' : 'Pasif'}
                  </span>
                  {t.lastSeen && (
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                      {format(new Date(t.lastSeen), 'd MMM')}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
          {withActivity.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              Henüz öğretmen yok.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
