import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'

export default async function DersProgramiLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile || !['mudur', 'mudur_yardimcisi'].includes(profile.role)) {
    redirect('/anasayfa')
  }
  return <>{children}</>
}
