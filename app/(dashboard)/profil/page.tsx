export const revalidate = 300

import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import ProfilForm from './ProfilForm'
import ProfilTabNav from './ProfilTabNav'
import { isTeachingRole } from '@/src/shared/types'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()
  const showTeacherTabs = isTeachingRole(profile?.role)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <ProfilTabNav active="profil" showTeacherTabs={showTeacherTabs} />
      <ProfilForm
        defaultFullName={profile?.full_name ?? ''}
        defaultSubject={profile?.subject ?? ''}
        schoolName={profile?.schools?.name ?? null}
        email={user.email ?? ''}
        role={profile?.role ?? 'ogretmen'}
      />
    </div>
  )
}
