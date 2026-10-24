import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import { DenemeService } from '@/src/domains/mentor/deneme/DenemeService'
import { gunAy } from '@/src/domains/mentor/lib/bultenMath'
import DenemeYukleForm from './DenemeYukleForm'
import DenemeSilButonu from './DenemeSilButonu'

export const metadata = { title: 'Denemeler' }

/** Stoys AGİS deneme yükleme (spec 2026-10-22). Mentör takip kapısının arkasında; yalnız kendi öğrencileri. */
export default async function DenemelerPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  if (!(await TakipService.acikMi())) notFound()
  const liste = await DenemeService.liste()
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/mentorluk" className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mt-1">Denemeler</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Stoys&apos;tan indirdiğin AGİS Excel&apos;ini (TM, FKB ya da TCD) yükle. Yalnız kendi öğrencilerinin sonuçları kaydedilir; dosyadaki diğer satırlar saklanmaz.
        </p>
      </div>
      <DenemeYukleForm bugun={todayLocalISO()} />
      <section aria-label="Yüklenen denemeler">
        <h2 className="text-base font-semibold mb-2">Yüklenen denemeler</h2>
        {liste.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">Henüz deneme yüklenmedi.</p> : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700 border border-gray-200 dark:border-slate-700 rounded-lg">
            {liste.map(d => (
              <li key={`${d.sinavId}|${d.sinifId}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span><b>{d.tur}</b> · {gunAy(d.tarih)} · {d.sinif} · {d.ogrenciSayisi} öğrenci</span>
                <DenemeSilButonu sinavId={d.sinavId} sinifId={d.sinifId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
