import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfilForm from './ProfilForm'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <span className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
          Profilim
        </span>
        <Link
          href="/profil/dosyam"
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Dosyam
        </Link>
      </div>
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

