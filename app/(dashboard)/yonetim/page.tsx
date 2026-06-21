import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/src/shared/auth'
import { format } from '@/src/shared/date'
import BugunYoklamaWidget from './BugunYoklamaWidget'
import UyariBandi from './UyariBandi'
import OkulSeviyesiKartlari from './OkulSeviyesiKartlari'
import AylikDevamsizlikWidget from './AylikDevamsizlikWidget'
import NobetCizelgesi from './NobetCizelgesi'

export const revalidate = 60
export const metadata = { title: 'Okul Durumu' }

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

      {/* Okul nöbet çizelgesi */}
      <Suspense fallback={<CardSkeleton />}>
        <NobetCizelgesi />
      </Suspense>

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
