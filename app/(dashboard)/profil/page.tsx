import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import ProfilForm from './ProfilForm'
import PasswordForm from './PasswordForm'
import BildirimTercihleri from './BildirimTercihleri'
import { getNotificationPreferences } from '@/src/domains/notifications/actions'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [profile, prefs] = await Promise.all([getCurrentProfile(), getNotificationPreferences()])

  return (
    <div>
      <ProfilForm
        defaultFullName={profile?.full_name ?? ''}
        defaultSubject={profile?.subject ?? ''}
        schoolName={profile?.schools?.name ?? null}
        email={user.email ?? ''}
      />
      <div className="px-4 md:px-6 pb-6 max-w-lg mx-auto">
        <PasswordForm />
      </div>
      <BildirimTercihleri
        defaultDays={prefs?.days_before ?? 1}
        defaultEmailOn={prefs?.email_on ?? true}
      />
    </div>
  )
}

