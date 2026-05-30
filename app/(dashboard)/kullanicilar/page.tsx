import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove, type Role } from '@/src/shared/types'
import InviteUserForm from './InviteUserForm'
import KullaniciFiltreli, { type UserRow, type SessionSummary } from './KullaniciFiltreli'

export const revalidate = 60

export default async function KullanicilarPage() {
  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) redirect('/anasayfa')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isMY = profile.role === 'mudur_yardimcisi'

  let profilesQuery = supabase.from('profiles').select('id, full_name, subject, role').order('full_name')
  if (isMY) profilesQuery = profilesQuery.neq('role', 'mudur')

  const [{ data }, { data: sessionsRaw }] = await Promise.all([
    profilesQuery,
    supabase.from('user_sessions').select('user_id, login_at, last_seen_at, logout_at, duration_minutes').eq('school_id', profile.school_id),
  ])

  const users = (data ?? []) as UserRow[]

  // Kullanıcı başına oturum özeti — plain object olarak geçir (client component için serialize edilebilir)
  const sessions: Record<string, SessionSummary> = {}
  for (const s of (sessionsRaw ?? [])) {
    const prev = sessions[s.user_id] ?? { count: 0, totalMinutes: 0, lastSeen: null }
    prev.count += 1
    const mins = s.duration_minutes ?? Math.round(
      (new Date(s.last_seen_at).getTime() - new Date(s.login_at).getTime()) / 60000
    )
    prev.totalMinutes += Math.max(mins, 1)
    if (!prev.lastSeen || s.last_seen_at > prev.lastSeen) prev.lastSeen = s.last_seen_at
    sessions[s.user_id] = prev
  }

  const isMudur = profile.role === 'mudur'
  const canAssign = isMudur || isMY
  const assignableRoles = (isMudur
    ? ['mudur_yardimcisi', 'zumre_baskani', 'ogretmen']
    : ['zumre_baskani', 'ogretmen']) as Role[]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Kullanıcılar</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {users.length} kullanıcı · okul geneli
          </p>
        </div>
        {canAssign && <InviteUserForm canAssignRoles={assignableRoles} />}
      </div>

      <KullaniciFiltreli
        users={users}
        sessions={sessions}
        currentUserId={user.id}
        isMudur={isMudur}
        canAssign={canAssign}
        assignableRoles={assignableRoles}
      />
    </div>
  )
}
