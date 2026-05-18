import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import type { Role } from '@/src/shared/types'
import RaporlarTabs from './RaporlarTabs'

const ALLOWED_ROLES: Role[] = ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur']

export default async function RaporlarLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile || !ALLOWED_ROLES.includes(profile.role as Role)) {
    redirect('/anasayfa')
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Raporlar</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Öğrenci, sınıf ve öğretmen analiz raporları</p>
      </div>

      <RaporlarTabs role={profile.role} />

      {children}
    </div>
  )
}
