import Link from 'next/link'
import type { HomeworkLite } from '@/src/domains/dashboard/types'

interface Props {
  todayHomeworks: HomeworkLite[]
  kontrolEdilenHwIds: string[]
}

/** Bugün son teslim günü olan ödevler — öğretmenin günün asıl işi, sayfanın üstünde dikkat çeker.
 *  Yalnız bugün teslimi olan ödev varsa görünür. */
export default function BugunYapilacaklarWidget({ todayHomeworks, kontrolEdilenHwIds }: Props) {
  if (todayHomeworks.length === 0) return null
  const kontrolEdilen = new Set(kontrolEdilenHwIds)
  const bekleyen = todayHomeworks.filter(h => !kontrolEdilen.has(h.id)).length
  const tamam = bekleyen === 0

  return (
    <section
      aria-labelledby="bugun-kontrol-baslik"
      className={`rounded-xl border-2 overflow-hidden mb-4 ${
        tamam
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20'
          : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 shadow-sm'
      }`}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <span
          aria-hidden
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${
            tamam ? 'bg-emerald-600' : 'bg-amber-700'
          }`}
        >
          {tamam ? '✓' : bekleyen}
        </span>
        <div className="min-w-0">
          <h2 id="bugun-kontrol-baslik" className="text-base font-bold text-gray-900 dark:text-slate-100">
            Bugün kontrol edilecek ödevler
          </h2>
          <p className={`text-xs font-medium ${tamam ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}>
            {tamam ? 'Hepsini kontrol ettin' : `${bekleyen} ödev kontrol bekliyor`}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-amber-200/70 dark:divide-slate-700 bg-white dark:bg-slate-800 border-t border-amber-200/70 dark:border-slate-700">
        {todayHomeworks.map(hw => {
          const edildi = kontrolEdilen.has(hw.id)
          return (
            <li key={hw.id}>
              <Link
                href={`/odevler/${hw.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span className="shrink-0 rounded-md bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-slate-200">
                  {hw.classes?.name ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-slate-100">{hw.title}</span>
                  <span className="block text-xs text-gray-500 dark:text-slate-400">{hw.subject}</span>
                </span>
                {edildi ? (
                  <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">✓ Kontrol edildi</span>
                ) : (
                  <span className="shrink-0 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white">
                    Kontrol et →
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
