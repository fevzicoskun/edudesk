import type { Metadata } from 'next'
import LandingNavbar from '@/app/components/landing/LandingNavbar'
import LandingHero from '@/app/components/landing/LandingHero'
import LandingFeatures from '@/app/components/landing/LandingFeatures'
import LandingHowItWorks from '@/app/components/landing/LandingHowItWorks'
import LandingForWhom from '@/app/components/landing/LandingForWhom'
import LandingFooter from '@/app/components/landing/LandingFooter'

export const metadata: Metadata = {
  title: 'EduDesk — Okulunuzun tüm takibi tek ekranda',
  description:
    'Yoklama, ödev, veli iletişimi ve zümre toplantıları. Türk okulları için tasarlanmış okul yönetim platformu.',
  openGraph: {
    title: 'EduDesk — Okulunuzun tüm takibi tek ekranda',
    description:
      'Yoklama, ödev, veli iletişimi ve zümre toplantıları. Türk okulları için tasarlanmış okul yönetim platformu.',
    url: 'https://myedudesk.com.tr',
    siteName: 'EduDesk',
    locale: 'tr_TR',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <main>
      <LandingNavbar />
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingForWhom />
      <LandingFooter />
    </main>
  )
}
