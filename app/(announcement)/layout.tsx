import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/src/shared/auth'

export default async function AnnouncementLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
