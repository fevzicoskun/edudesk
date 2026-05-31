import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/src/shared/auth'
import { format } from '@/src/shared/date'
import BugunYoklamaWidget from './BugunYoklamaWidget'
import UyariBandi from './UyariBandi'
import OkulSeviyesiKartlari from './OkulSeviyesiKartlari'
import AylikDevamsizlikWidget from './AylikDevamsizlikWidget'

export const revalidate = 0

function CardSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800 ${tall ? 'h-64' : 'h-32'}`} />
  )
}

const QUICK_LINKS = [
  {
    href:  '/kullanicilar',
    label: 'Kullanıcılar',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href:  '/yonetim/ogrenciler',
    label: 'Öğrenciler',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7m-7-3.5v4.5a7 7 0 0014 0v-4.5" />
      </svg>
    ),
  },
  {
    href:  '/duyurular',
    label: 'Duyurular',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
  {
    href:  '/raporlar',
    label: 'Raporlar',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href:  '/toplantilar',
    label: 'Toplantılar',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href:  '/yonetim/devamsizlar',
    label: 'Devamsızlar',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default async function YonetimPage() {
  const profile = await getCurrentProfile()
  if (!profile || !['mudur', 'mudur_yardimcisi'].includes(profile.role ?? '')) redirect('/anasayfa')

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* Başlık */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Okul Durumu</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {profile.full_name ?? ''} · {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {/* Kademe kartları */}
      <Suspense fallback={<CardSkeleton />}>
        <OkulSeviyesiKartlari />
      </Suspense>

      {/* Uyarı bandı */}
      <Suspense fallback={null}>
        <UyariBandi />
      </Suspense>

      {/* Bugün + aylık devamsızlık */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<CardSkeleton tall />}>
          <AylikDevamsizlikWidget />
        </Suspense>
        <Suspense fallback={<CardSkeleton tall />}>
          <BugunYoklamaWidget />
        </Suspense>
      </div>

      {/* Hızlı erişim */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">
          Hızlı Erişim
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {QUICK_LINKS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            >
              {icon}
              <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
