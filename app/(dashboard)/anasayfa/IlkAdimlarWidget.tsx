import Link from 'next/link'
import EmptyState from '@/app/components/EmptyState'

const SETUP_STEPS = [
  { n: 1, title: 'Sınıf ekle', href: '/siniflar' },
  { n: 2, title: 'Öğrenci ekle', href: '/yonetim/ogrenciler' },
  { n: 3, title: 'Öğretmen davet et', href: '/kullanicilar' },
]

/** Müdür/MY, okulda 0 sınıf → 3 adımlık kurulum yönlendirmesi. */
export function KurulumWidget() {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Okulunu kur</h2>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 mb-4">Başlamak için şu adımları tamamla.</p>
      <ol className="space-y-2">
        {SETUP_STEPS.map(s => (
          <li key={s.n}>
            <Link
              href={s.href}
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors"
            >
              <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center justify-center shrink-0">
                {s.n}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{s.title}</span>
              <svg className="w-4 h-4 text-gray-300 dark:text-slate-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Öğretmen/zümre başkanı, atanmış 0 sınıf → pasif bekleme. */
export function BeklemeWidget() {
  return (
    <EmptyState
      title="Henüz sana sınıf atanmadı"
      description="Müdürün sınıf atadığında dersleriniz ve yoklamalarınız burada görünecek."
    />
  )
}
