import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/Toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  return (
    <ToastProvider>
      <div className="flex h-full bg-gray-50 dark:bg-slate-950">
        <Sidebar profile={profile} email={user.email ?? ''} />
        <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0">{children}</main>
      </div>
    </ToastProvider>
  )
}
