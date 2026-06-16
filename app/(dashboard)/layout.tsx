import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/Toast'
import QuickAddDrawer from '@/components/homework/QuickAddDrawer'
import CommandPalette from '@/components/CommandPalette'
import { isTeachingRole } from '@/src/shared/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  // Müdür için onboarding kontrolü — slug artık getCurrentProfile()'dan geliyor, ekstra sorgu yok
  if (profile?.role === 'mudur' && profile.school_id) {
    const slug = profile.schools?.slug ?? ''
    if (!/^[A-Z]{3,4}\d{3,4}$/.test(slug)) {
      redirect('/onboarding')
    }
  }

  return (
    <ToastProvider>
      <div className="flex h-full bg-gray-50 dark:bg-slate-950">
        <div className="print:hidden">
          <Sidebar profile={profile} email={user.email ?? ''} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="print:hidden">
            <TopBar userId={profile?.id} />
          </div>
          <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0 mobile-main print:overflow-visible print:pt-0">{children}</main>
        </div>
      </div>
      <div className="print:hidden">
        {isTeachingRole(profile?.role) && <QuickAddDrawer />}
        <CommandPalette />
      </div>
    </ToastProvider>
  )
}
