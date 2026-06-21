import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { isMudurOrAbove, type Role } from '@/src/shared/types'
import { UserRepository } from '@/src/domains/users/repositories/UserRepository'
import InviteUserForm from './InviteUserForm'
import KullaniciFiltreli, { type UserRow, type SessionSummary, type ClassRow } from './KullaniciFiltreli'
import SchoolCodeCard from './SchoolCodeCard'

export const revalidate = 60

export const metadata = { title: 'Kullanıcılar' }

export default async function KullanicilarPage() {
  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) redirect('/anasayfa')

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const isMY = profile.role === 'mudur_yardimcisi'
  const isMudur = profile.role === 'mudur'

  let profilesQuery = supabase.from('profiles').select('id, full_name, subject, role').eq('school_id', profile.school_id).order('full_name')
  if (isMY) profilesQuery = profilesQuery.neq('role', 'mudur')

  const [{ data }, { data: sessionsRaw }, { data: schoolData }, { data: classesData }] = await Promise.all([
    profilesQuery,
    supabase.from('user_sessions').select('user_id, login_at, last_seen_at, logout_at, duration_minutes').eq('school_id', profile.school_id),
    (isMudur || isMY) && profile.school_id
      ? supabase.from('schools').select('slug').eq('id', profile.school_id).single()
      : Promise.resolve({ data: null }),
    UserRepository.getSchoolClasses(profile.school_id),
  ])

  const users      = (data ?? []) as UserRow[]
  const allClasses = (classesData ?? []) as ClassRow[]
  const classIds   = allClasses.map(c => c.id)

  const { data: tcData } = await UserRepository.getSchoolTeacherClasses(classIds)
  const teacherAssignments: Record<string, string[]> = {}
  for (const row of (tcData ?? [])) {
    if (!teacherAssignments[row.teacher_id]) teacherAssignments[row.teacher_id] = []
    teacherAssignments[row.teacher_id].push(row.class_id)
  }

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

  const canAssign = isMudur || isMY
  const assignableRoles = (isMudur
    ? ['mudur_yardimcisi', 'zumre_baskani', 'ogretmen']
    : ['zumre_baskani', 'ogretmen']) as Role[]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Kullanıcılar</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {users.length} kullanıcı · okul geneli
          </p>
        </div>
        {canAssign && <InviteUserForm canAssignRoles={assignableRoles} />}
      </div>

      {(isMudur || isMY) && (
        <SchoolCodeCard initialCode={(schoolData as { slug?: string } | null)?.slug ?? null} />
      )}

      <KullaniciFiltreli
        users={users}
        sessions={sessions}
        currentUserId={user.id}
        isMudur={isMudur}
        canAssign={canAssign}
        assignableRoles={assignableRoles}
        classes={allClasses}
        teacherAssignments={teacherAssignments}
      />
    </div>
  )
}
