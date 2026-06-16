import Link from 'next/link'

export default function LandingHero() {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-stone-50 px-4 py-20 text-center">
      <div className="mx-auto max-w-3xl">
        <span className="mb-4 inline-block rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-800">
          Türk okulları için tasarlandı
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          Okulunuzun tüm takibini{' '}
          <span className="text-blue-600">tek ekranda</span> yapın
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-stone-600">
          Yoklama, ödev ve veli iletişimi — hepsi bir arada.
        </p>
        <div className="mt-10 flex justify-center">
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
