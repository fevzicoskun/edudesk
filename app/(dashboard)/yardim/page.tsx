import { getCurrentProfile } from '@/src/shared/auth'
import YardimClient from './YardimClient'

function roleToTab(role: string | null | undefined): string {
  if (role === 'mudur')            return 'mudur'
  if (role === 'mudur_yardimcisi') return 'my'
  if (role === 'zumre_baskani')    return 'zumre'
  return 'ogretmen'
}

export default async function YardimPage() {
  const profile = await getCurrentProfile()
  return <YardimClient defaultTab={roleToTab(profile?.role)} />
}
