import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { AnnouncementService } from '@/src/domains/announcements/services/AnnouncementService'
import Sidebar from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/Toast'
import SessionTracker from '@/components/SessionTracker'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  // Müdür için onboarding kontrolü — okul kurulmamışsa yönlendir
  if (profile?.role === 'mudur' && profile.school_id) {
    const supabase = await createClient()
    const { data: school } = await supabase
      .from('schools')
      .select('slug')
      .eq('id', profile.school_id)
      .single()

    const slug = school?.slug ?? ''
    if (!/^[A-Z]{3,4}\d{3,4}$/.test(slug)) {
      redirect('/onboarding')
    }
  }

  // Okunmamış duyuru varsa tam ekran duyuru sayfasına yönlendir
  const unreadAnnouncement = await AnnouncementService.getFirstUnread()
  if (unreadAnnouncement) redirect('/duyuru')

  return (
    <ToastProvider>
      <div className="flex h-full bg-gray-50 dark:bg-slate-950">
        <Sidebar profile={profile} email={user.email ?? ''} />
        <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0">{children}</main>
      </div>
      <SessionTracker />
    </ToastProvider>
  )
}
