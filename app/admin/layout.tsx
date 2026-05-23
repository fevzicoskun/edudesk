import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/src/shared/auth'
import { createServiceClient } from '@/src/infrastructure/supabase/service'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data } = await db
    .from('platform_admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) redirect('/anasayfa')

  return <>{children}</>
}
