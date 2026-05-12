import { getCurrentUser, getCurrentProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProfilForm from './ProfilForm'

export default async function ProfilPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user) redirect('/login')

  return (
    <ProfilForm
      defaultFullName={profile?.full_name ?? ''}
      defaultSubject={profile?.subject ?? ''}
      defaultOkulAdi={(profile as unknown as { okul_adi?: string })?.okul_adi ?? ''}
      email={user.email ?? ''}
    />
  )
}
