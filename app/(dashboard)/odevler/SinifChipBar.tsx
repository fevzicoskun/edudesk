import Link from 'next/link'
import type { FilterParams } from './types'

interface Props {
  classes: { id: string; name: string }[]
  pendingByClass: Map<string, number>
  params: FilterParams
}

/** Sınıf filtresi — tek yerden sınıf seçimi (eski "Tüm sınıflar" açılır menüsünün yerine). */
export default function SinifChipBar({ classes, pendingByClass, params }: Props) {
  if (!classes.length) return null

  // Sınıf değişince diğer filtreler korunur, sayfa başa döner
  const href = (sinif?: string) => {
    const q = new URLSearchParams()
    if (sinif)           q.set('sinif', sinif)
    if (params.ders)     q.set('ders', params.ders)
    if (params.ogretmen) q.set('ogretmen', params.ogretmen)
    if (params.q)        q.set('q', params.q)
    const s = q.toString()
    return s ? `/odevler?${s}` : '/odevler'
  }

  const chip = (secili: boolean) =>
    `flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
      secili
        ? 'bg-gray-900 border-gray-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900'
        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
    }`

  const secili = classes.find(c => c.id === params.sinif)

  return (
    <div className="mb-5">
      <nav aria-label="Sınıf filtresi" className="flex gap-2 overflow-x-auto pb-1">
        <Link href={href()} className={chip(!params.sinif)} aria-current={!params.sinif ? 'page' : undefined}>
          Tümü
        </Link>
        {classes.map(cls => {
          const aktif = cls.id === params.sinif
          const bekleyen = (pendingByClass.get(cls.id) ?? 0) > 0
          return (
            <Link key={cls.id} href={href(cls.id)} className={chip(aktif)} aria-current={aktif ? 'page' : undefined}>
              {cls.name}
              {bekleyen && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="kontrol bekleyen ödev var" />}
            </Link>
          )
        })}
      </nav>
      {secili && (
        <Link
          href={`/odevler/sinif/${secili.id}`}
          className="inline-block mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {secili.name} öğrenci × ödev tablosu →
        </Link>
      )}
    </div>
  )
}
