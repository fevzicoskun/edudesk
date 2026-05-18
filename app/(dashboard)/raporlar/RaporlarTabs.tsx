import { getCurrentProfile } from '@/src/shared/auth'
import RaporlarTabsLinks from './RaporlarTabsLinks'

const BASE_TABS = [
  { href: '/raporlar/ogrenci', label: 'Öğrenci' },
  { href: '/raporlar/sinif', label: 'Sınıf' },
  { href: '/raporlar/ogretmen', label: 'Öğretmen' },
]

const MENTOR_TAB = { href: '/raporlar/mentor', label: 'Mentör' }

export default async function RaporlarTabs() {
  const profile = await getCurrentProfile()
  const role = profile?.role ?? ''
  const showMentorTab = role === 'mudur' || role === 'mudur_yardimcisi' || role === 'zumre_baskani'
  const tabs = showMentorTab ? [...BASE_TABS, MENTOR_TAB] : BASE_TABS

  return <RaporlarTabsLinks tabs={tabs} />
}
