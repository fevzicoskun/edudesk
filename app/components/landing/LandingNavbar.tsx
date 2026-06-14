import Link from 'next/link'
import EduDeskLogo from '@/components/EduDeskLogo'

export default function LandingNavbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <EduDeskLogo size="md" />
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Giriş Yap →
          </Link>
        </div>
      </div>
    </nav>
  )
}
