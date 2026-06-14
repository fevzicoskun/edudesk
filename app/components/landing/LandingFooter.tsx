import Link from 'next/link'

export default function LandingFooter() {
  return (
    <footer className="border-t border-stone-200 bg-stone-900 px-4 py-16 text-center">
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 text-xl font-semibold text-white">
          Okulunuz için EduDesk&apos;i deneyin
        </p>
        <p className="mb-8 text-stone-400">
          Hesabınızla giriş yapın, tüm okul takibini tek ekranda yönetin.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          Giriş Yap →
        </Link>
        <div className="mt-12 flex justify-center gap-6 text-sm text-stone-500">
          <Link href="/gizlilik" className="hover:text-stone-300 transition-colors">
            Gizlilik Politikası
          </Link>
          <Link href="/kullanim-kosullari" className="hover:text-stone-300 transition-colors">
            Kullanım Koşulları
          </Link>
        </div>
        <p className="mt-6 text-xs text-stone-600">© 2026 EduDesk. Tüm hakları saklıdır.</p>
      </div>
    </footer>
  )
}
