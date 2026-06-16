import Link from 'next/link'
import EduDeskLogo from '@/components/EduDeskLogo'
import { getWhatsAppHref } from './whatsapp'

export default function LandingNavbar() {
  const waHref = getWhatsAppHref()
  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <EduDeskLogo size="md" />
        <div className="flex items-center gap-3">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp'tan bilgi al (yeni sekmede açılır)"
            className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
          >
            WhatsApp&apos;tan Bilgi Al
          </a>
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Giriş Yap →
          </Link>
        </div>
      </div>
    </nav>
  )
}
