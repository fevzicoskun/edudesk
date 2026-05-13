import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-200 dark:text-slate-700">404</p>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-4">Sayfa bulunamadı</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">Aradığın sayfa mevcut değil ya da taşınmış olabilir.</p>
        <Link
          href="/anasayfa"
          className="mt-6 inline-block bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  )
}
