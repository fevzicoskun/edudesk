import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/Toast'
import QuickAddDrawer from '@/components/homework/QuickAddDrawer'
import CommandPalette from '@/components/CommandPalette'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import PushTesvikSeridi from './PushTesvikSeridi'
import UsageTracker from './UsageTracker'
import AbonelikUyariSeridi from './AbonelikUyariSeridi'
import { subscriptionState, kalanGun } from '@/src/domains/billing/subscriptionMath'
import { todayLocalISO } from '@/src/shared/date'
import { logger } from '@/src/infrastructure/observability/logger'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  // Abonelik enforcement (fail-open: schools okunamazsa geçir — tahsilat güvenlik sınırı değil).
  let abonelikUyari: number | null = null
  if (profile?.school_id) {
    if (!profile.schools) {
      logger.error({ event: 'abonelik_schools_missing', userId: profile.id }, 'Profile schools join boş — enforcement atlandı')
    } else {
      const today = todayLocalISO()
      const state = subscriptionState(profile.schools, today)
      if (state === 'expired' || state === 'suspended') redirect('/abonelik-gerekli')
      if (state === 'expiring' && isMudurOrAbove(profile.role) && profile.schools.access_until) {
        abonelikUyari = kalanGun(profile.schools.access_until, today)
      }
    }
  }

  // Müdür için onboarding kontrolü — slug artık getCurrentProfile()'dan geliyor, ekstra sorgu yok
  if (profile?.role === 'mudur' && profile.school_id) {
    const slug = profile.schools?.slug ?? ''
    if (!/^[A-Z]{3,4}\d{3,4}$/.test(slug)) {
      redirect('/onboarding')
    }
  }

  return (
    <ToastProvider>
      <UsageTracker />
      <div className="flex h-full bg-gray-50 dark:bg-slate-950">
        <div className="print:hidden">
          <Sidebar profile={profile} email={user.email ?? ''} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="print:hidden">
            <TopBar userId={profile?.id} />
          </div>
          <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0 mobile-main print:overflow-visible print:pt-0">{abonelikUyari !== null && <AbonelikUyariSeridi kalan={abonelikUyari} />}<PushTesvikSeridi />{children}</main>
        </div>
      </div>
      <div className="print:hidden">
        {isTeachingRole(profile?.role) && <QuickAddDrawer />}
        <CommandPalette />
      </div>
    </ToastProvider>
  )
}
