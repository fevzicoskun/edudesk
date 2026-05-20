import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import Link from 'next/link'
import { format, parseISO, subDays } from '@/src/shared/date'
import { ROLE_LABELS, type Role } from '@/src/shared/types'

const ROLE_BADGE: Record<Role, string> = {
  mudur:            'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  mudur_yardimcisi: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  zumre_baskani:    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  ogretmen:         'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

export default async function ZumreOgretmenWidget() {
  const supabase = await createClient()
  const school_id = await requireSchoolId()

  const today = new Date()
  const twoWeeksAgo   = subDays(today, 14).toISOString()
  const thirtyDaysAgo = subDays(today, 30).toISOString().split('T')[0]

  const [zumreRes, profilesRes, sessionsRes] = await Promise.all([
    supabase.from('zumre_meetings').select('id, title, meeting_date, branch')
      .eq('school_id', school_id).order('meeting_date', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, full_name, role, subject')
      .eq('school_id', school_id)
      .in('role', ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi']),
    supabase.from('user_sessions').select('user_id, login_at, last_seen_at, duration_minutes')
      .eq('school_id', school_id),
  ])

  const zumreMeetings = zumreRes.data    ?? []
  const teachers      = profilesRes.data ?? []

  type SessionSummary = { count: number; totalMinutes: number; lastSeen: string | null }
  const sessionMap = new Map<string, SessionSummary>()
  for (const s of sessionsRes.data ?? []) {
    const prev = sessionMap.get(s.user_id) ?? { count: 0, totalMinutes: 0, lastSeen: null }
    prev.count += 1
    const mins = s.duration_minutes ?? Math.max(
      Math.round((new Date(s.last_seen_at).getTime() - new Date(s.login_at).getTime()) / 60000), 1
    )
    prev.totalMinutes += mins
    if (!prev.lastSeen || s.last_seen_at > prev.lastSeen) prev.lastSeen = s.last_seen_at
    sessionMap.set(s.user_id, prev)
  }

  const recentBranches = new Set(
    zumreMeetings.filter(m => m.meeting_date >= thirtyDaysAgo).map(m => m.branch).filter(Boolean)
  )
  const allBranches = new Set(
    [...teachers.map(t => t.subject), ...zumreMeetings.map(m => m.branch)].filter(Boolean) as string[]
  )
  const branches = [...allBranches].sort().map(b => ({
    name: b,
    active: recentBranches.has(b),
    lastDate: zumreMeetings.find(m => m.branch === b)?.meeting_date,
  }))

  const sortedTeachers = [...teachers].sort((a, b) => {
    const aL = sessionMap.get(a.id)?.lastSeen ?? ''
    const bL = sessionMap.get(b.id)?.lastSeen ?? ''
    return bL.localeCompare(aL)
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Zümre Durumu (30 Gün)</h2>
        </div>
        {branches.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Henüz zümre kaydı yok.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">
            {branches.map(b => (
              <li key={b.name} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${b.active ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{b.name}</p>
                  {b.lastDate && <p className="text-[11px] text-gray-400">Son: {format(parseISO(b.lastDate), 'd MMM')}</p>}
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${b.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                  {b.active ? 'Aktif' : 'Pasif'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lg:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Öğretmen Aktivitesi</h2>
          <Link href="/kullanicilar" className="text-xs text-purple-600 font-medium hover:underline">Tümü →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Ad Soyad</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Branş</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Giriş</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Son Görülme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {sortedTeachers.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Henüz öğretmen kaydı yok.</td></tr>
              ) : sortedTeachers.map(t => {
                const stats    = sessionMap.get(t.id)
                const inactive = !stats?.lastSeen || stats.lastSeen < twoWeeksAgo
                return (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">{t.full_name}</p>
                        {inactive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 font-semibold">Pasif</span>}
                      </div>
                      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${ROLE_BADGE[t.role as Role] ?? ROLE_BADGE.ogretmen}`}>
                        {ROLE_LABELS[t.role as Role] ?? t.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400 text-xs hidden sm:table-cell">{t.subject ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {stats ? (
                        <div>
                          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{stats.count} kez</p>
                          <p className="text-[11px] text-gray-400">{(stats.totalMinutes / 60).toFixed(1)} saat</p>
                        </div>
                      ) : <span className="text-xs text-gray-400">Yok</span>}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-500 dark:text-slate-400">
                      {stats?.lastSeen ? new Date(stats.lastSeen).toLocaleDateString('tr-TR') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
