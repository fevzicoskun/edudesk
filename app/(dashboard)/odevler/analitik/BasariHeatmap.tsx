'use client'

import { useState } from 'react'
import { format, parseISO } from '@/src/shared/date'
import type { ClassWeekHeatmap, HeatLevel } from '@/src/domains/homework/lib/analitik'

// Renk + ikon: bilgi yalnız renge bağlı değil (WCAG 1.4.1 — renk körü erişilebilirliği).
const LEVEL_STYLE: Record<HeatLevel, { bg: string; icon: string; label: string }> = {
  high: { bg: 'bg-emerald-500',  icon: '✓', label: 'İyi' },
  mid:  { bg: 'bg-amber-400',    icon: '!', label: 'Orta' },
  low:  { bg: 'bg-red-500',      icon: '✕', label: 'Düşük' },
}

function haftaEtiketi(weekKey: string): string {
  try { return format(parseISO(weekKey), 'd MMM') } catch { return weekKey }
}

export default function BasariHeatmap({ data }: { data: ClassWeekHeatmap }) {
  const [sinif, setSinif] = useState<string>('hepsi')

  if (data.rows.length === 0) {
    return (
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Başarı Haritası</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Henüz haftalık başarı verisi yok. Ödevler işaretlendikçe burada sınıf bazlı ısı haritası oluşur.
        </p>
      </section>
    )
  }

  const gosterilen = sinif === 'hepsi' ? data.rows : data.rows.filter(r => r.classId === sinif)

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 mb-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Başarı Haritası</h2>
        <label className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
          Sınıf:
          <select
            value={sinif}
            onChange={e => setSinif(e.target.value)}
            className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
          >
            <option value="hepsi">Tümü</option>
            {data.rows.map(r => (
              <option key={r.classId} value={r.classId}>{r.className}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left text-[11px] font-medium text-gray-500 dark:text-slate-400 pr-2 sticky left-0 bg-white dark:bg-slate-800">
                Sınıf
              </th>
              {data.weeks.map(w => (
                <th key={w} className="text-[10px] font-medium text-gray-500 dark:text-slate-400 px-1 min-w-[40px] text-center">
                  {haftaEtiketi(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gosterilen.map(row => (
              <tr key={row.classId}>
                <td className="text-xs font-medium text-gray-700 dark:text-slate-300 pr-2 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-800">
                  {row.className}
                </td>
                {row.cells.map((cell, i) => {
                  if (!cell) {
                    return (
                      <td key={i} className="p-0">
                        <div
                          className="h-9 w-10 rounded bg-gray-100 dark:bg-slate-700/50 flex items-center justify-center text-gray-300 dark:text-slate-600 text-xs"
                          title={`${row.className} · ${haftaEtiketi(data.weeks[i])}: ödev yok`}
                        >
                          –
                        </div>
                      </td>
                    )
                  }
                  const st = LEVEL_STYLE[cell.level]
                  return (
                    <td key={i} className="p-0">
                      <div
                        className={`h-9 w-10 rounded ${st.bg} flex flex-col items-center justify-center text-white leading-none`}
                        title={`${row.className} · ${haftaEtiketi(data.weeks[i])}: %${cell.pct} (${st.label})`}
                      >
                        <span aria-hidden className="text-[11px]">{st.icon}</span>
                        <span className="text-[9px] font-semibold mt-0.5">%{cell.pct}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lejant — renk + ikon açıklaması */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500 dark:text-slate-400">
        {(['high', 'mid', 'low'] as HeatLevel[]).map(lvl => {
          const st = LEVEL_STYLE[lvl]
          return (
            <span key={lvl} className="flex items-center gap-1">
              <span className={`inline-flex h-3.5 w-3.5 rounded ${st.bg} items-center justify-center text-white text-[8px]`} aria-hidden>{st.icon}</span>
              {st.label}
            </span>
          )
        })}
        <span className="flex items-center gap-1">
          <span className="inline-block h-3.5 w-3.5 rounded bg-gray-100 dark:bg-slate-700/50" aria-hidden />
          Ödev yok
        </span>
      </div>
    </section>
  )
}
