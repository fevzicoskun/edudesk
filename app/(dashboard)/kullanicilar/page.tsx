import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { isMudurOrAbove, type Role } from '@/src/shared/types'
import { UserRepository } from '@/src/domains/users/repositories/UserRepository'
import InviteUserForm from './InviteUserForm'
import KullaniciFiltreli, { type UserRow, type KullanimOzeti, type ClassRow } from './KullaniciFiltreli'
import { getOkulKullanim } from '@/src/domains/dashboard/queries/schoolStats'
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

  const [{ data }, kullanimMap, { data: schoolData }, { data: classesData }] = await Promise.all([
    profilesQuery,
    getOkulKullanim(), // usage_daily — yalnız müdür/MY'ye döner (RLS); diğer rollerde boş
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

  // Son 30 gün kullanım özeti — plain object (client component'e serialize edilebilir)
  const kullanim: Record<string, KullanimOzeti> = Object.fromEntries(kullanimMap)

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
        kullanim={kullanim}
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
