export const revalidate = 300

import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import ProfilForm from './ProfilForm'
export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  return (
    <ProfilForm
      defaultFullName={profile?.full_name ?? ''}
      defaultSubject={profile?.subject ?? ''}
      schoolName={profile?.schools?.name ?? null}
      email={user.email ?? ''}
      role={profile?.role ?? 'ogretmen'}
      avatarUrl={profile?.avatar_url ?? null}
      userId={user.id}
    />
  )
}
