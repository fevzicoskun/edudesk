import Link from 'next/link'
import { getWhatsAppHref } from './whatsapp'

export default function LandingHero() {
  const waHref = getWhatsAppHref()
  return (
    <section className="bg-gradient-to-b from-emerald-50 to-stone-50 px-4 py-20 text-center">
      <div className="mx-auto max-w-3xl">
        <span className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-1 text-sm font-medium text-emerald-800">
          Türk okulları için tasarlandı
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          Okulunuzun tüm takibini{' '}
          <span className="text-emerald-600">tek ekranda</span> yapın
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-stone-600">
          Yoklama, ödev, veli iletişimi ve zümre toplantıları — hepsi bir arada.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl bg-orange-500 px-8 py-4 text-base font-semibold text-white shadow-md hover:bg-orange-600 transition-colors sm:w-auto"
          >
            📱 WhatsApp&apos;tan Bilgi Al
          </a>
          <Link
            href="/login"
            className="w-full rounded-xl border border-stone-300 px-8 py-4 text-base font-semibold text-stone-700 hover:bg-stone-100 transition-colors sm:w-auto"
          >
            Giriş Yap →
          </Link>
        </div>
      </div>
    </section>
  )
}
