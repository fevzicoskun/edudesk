import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/lib/supabase/server'
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
    if (!/^[A-Z]{3}\d{3}$/.test(slug)) {
      redirect('/onboarding')
    }
  }

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
