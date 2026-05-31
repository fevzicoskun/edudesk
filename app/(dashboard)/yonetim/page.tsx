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

export default async function YonetimPage() {
  const profile = await getCurrentProfile()
  if (!profile || !['mudur', 'mudur_yardimcisi'].includes(profile.role ?? '')) redirect('/anasayfa')

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* Başlık */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Okul Durumu</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {profile.full_name ?? ''} · {format(new Date(), 'd MMMM yyyy, EEEE')}
          </p>
        </div>
        <Link
          href="/toplantilar"
          className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Toplantı Kayıtları →
        </Link>
      </div>

      {/* Kademe kartları */}
      <Suspense fallback={<CardSkeleton />}>
        <OkulSeviyesiKartlari />
      </Suspense>

      {/* Uyarı bandı */}
      <Suspense fallback={null}>
        <UyariBandi />
      </Suspense>

      {/* Bu ay devamsızlık + Bugünkü yoklama yan yana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<CardSkeleton tall />}>
          <AylikDevamsizlikWidget />
        </Suspense>
        <div id="bugun-yoklama">
          <Suspense fallback={<CardSkeleton tall />}>
            <BugunYoklamaWidget />
          </Suspense>
        </div>
      </div>

    </div>
  )
}
