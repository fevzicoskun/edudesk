import Link from 'next/link'
import type { YoklamaDurumItem, HomeworkLite } from '@/src/domains/dashboard/types'
import { format, parseISO } from '@/src/shared/date'

interface Props {
  yoklamaDurumu:  YoklamaDurumItem[]
  todayHomeworks: HomeworkLite[]
  activeRiskCount: number
  hasClasses: boolean
}

export default function BugunYapilacaklarWidget({ yoklamaDurumu, todayHomeworks, activeRiskCount, hasClasses }: Props) {
  const eksikYoklama = yoklamaDurumu.filter(c => !c.alindi)
  const allDone   = hasClasses && eksikYoklama.length === 0 && todayHomeworks.length === 0 && activeRiskCount === 0
  const noClasses = !hasClasses && todayHomeworks.length === 0 && activeRiskCount === 0

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bugün Yapılacaklar</h2>
        {allDone && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
            Tümü tamam ✓
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-slate-700/60">

        {/* Yoklama Durumu */}
        {yoklamaDurumu.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Yoklama</p>
            <ul className="space-y-1.5">
              {yoklamaDurumu.map(c => (
                <li key={c.classId} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.alindi ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="text-sm text-gray-800 dark:text-slate-200 font-medium">{c.className}</span>
                  <span className={`text-[10px] font-semibold ${c.alindi ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {c.alindi ? 'Alındı' : 'Alınmadı'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bugün Son Gün Ödevler */}
        {todayHomeworks.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Bugün Son Gün</p>
            <ul className="space-y-1.5">
              {todayHomeworks.map(hw => (
                <li key={hw.id}>
                  <Link
                    href={`/odevler/${hw.id}`}
                    className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-sm text-gray-800 dark:text-slate-200 truncate">{hw.title}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{hw.classes?.name ?? ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risk Uyarısı */}
        {activeRiskCount > 0 && (
          <div className="px-4 py-3">
            <a
              href="#risk-uyarilari"
              className="flex items-center gap-2 group"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-sm text-gray-800 dark:text-slate-200">
                <span className="font-semibold text-rose-600 dark:text-rose-400">{activeRiskCount} öğrenci</span> risk altında
              </span>
              <span className="text-[11px] text-rose-500 group-hover:underline ml-auto shrink-0">Görüntüle →</span>
            </a>
          </div>
        )}

        {/* Her şey tamam */}
        {allDone && (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-gray-400 dark:text-slate-500">Bugün için bekleyen işlem yok.</p>
          </div>
        )}
        {noClasses && (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-gray-400 dark:text-slate-500">Henüz sınıf atanmamış.</p>
          </div>
        )}
      </div>
    </div>
  )
}
