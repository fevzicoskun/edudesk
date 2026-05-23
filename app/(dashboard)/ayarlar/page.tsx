import { getCurrentUser } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { getNotificationPreferences } from '@/src/domains/notifications/actions'
import BildirimTercihleri from '@/app/(dashboard)/profil/BildirimTercihleri'

export default async function AyarlarPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const prefs = await getNotificationPreferences()

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ayarlar</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Uygulama tercihleri</p>
      </div>
      <BildirimTercihleri
        defaultDays={prefs?.days_before ?? 1}
        defaultEmailOn={prefs?.email_on ?? true}
      />
    </div>
  )
}
