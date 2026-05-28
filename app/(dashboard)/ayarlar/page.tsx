import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { getNotificationPreferences } from '@/src/domains/notifications/actions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { isTeachingRole } from '@/src/shared/types'
import BildirimTercihleri from '@/app/(dashboard)/profil/BildirimTercihleri'
import PasswordForm from './PasswordForm'
import KaynakYonetimi from './KaynakYonetimi'

export default async function AyarlarPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) redirect('/login')

  const supabase = await createClient()
  const [prefs, sourcesRes] = await Promise.all([
    getNotificationPreferences(),
    isTeachingRole(profile.role)
      ? supabase
          .from('homework_sources')
          .select('id, name, subject')
          .eq('teacher_id', user.id)
          .eq('school_id', profile.school_id ?? '')
          .eq('active', true)
          .order('name')
      : Promise.resolve({ data: [] as { id: string; name: string; subject: string | null }[] }),
  ])

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
      <div className="mb-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ayarlar</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Uygulama tercihleri</p>
      </div>
      <BildirimTercihleri
        defaultDays={prefs?.days_before ?? 1}
        defaultEmailOn={prefs?.email_on ?? true}
      />
      {isTeachingRole(profile.role) && (
        <KaynakYonetimi initial={sourcesRes.data ?? []} />
      )}
      <PasswordForm />
    </div>
  )
}
