import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-full bg-gray-50 dark:bg-slate-950">
      <Sidebar profile={profile} email={user.email ?? ''} />
      <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0">{children}</main>
    </div>
  )
}
