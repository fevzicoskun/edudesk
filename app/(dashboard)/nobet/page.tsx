import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { format } from '@/src/shared/date'
import NobetCizelgesi from '../yonetim/NobetCizelgesi'

export const revalidate = 60
export const metadata = { title: 'Nöbet' }

function Skeleton() {
  return <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800 h-64" />
}

export default async function NobetPage() {
  const profile = await getCurrentProfile()
  if (!profile || !['mudur', 'mudur_yardimcisi'].includes(profile.role ?? '')) redirect('/anasayfa')

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Nöbet Çizelgesi</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      <Suspense fallback={<Skeleton />}>
        <NobetCizelgesi />
      </Suspense>
    </div>
  )
}
