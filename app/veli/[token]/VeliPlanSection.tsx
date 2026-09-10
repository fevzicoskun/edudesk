import { dayLabel, PLAN_STATUS_LABELS, type PlanStatus } from '@/src/domains/studyPlan/planMath'
import type { PortalWeek } from '@/src/domains/studyPlan/veliPlanMath'

const BADGE_COLOR: Record<PlanStatus, string> = {
  planlandi: 'bg-slate-100 text-slate-600 border-slate-200',
  yapildi:   'bg-green-100 text-green-700 border-green-200',
  eksik:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200',
}

// Salt-okunur: bu hafta + (varsa) gelecek hafta. Plan yoksa hiç render edilmez.
// data-veli-section bilinçli yok: veli_portal_events.section DB CHECK'i yalnız odevler/devamsizlik/notlar kabul ediyor.
export default function VeliPlanSection({ weeks }: { weeks: PortalWeek[] }) {
  if (!weeks.length) return null
  return (
    <section aria-labelledby="veli-plan-baslik" className="bg-white border border-gray-200 rounded-2xl p-4">
      <h2 id="veli-plan-baslik" className="text-sm font-semibold text-gray-700 mb-3">Haftalık Çalışma Planı</h2>
      <div className="space-y-4">
        {weeks.map(w => (
          <div key={w.weekStart} data-plan-hafta={w.weekStart}>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{w.baslik}</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {w.aralik} · {w.ozet.yapildi}/{w.ozet.toplam} yapıldı
              </p>
            </div>
            <ul className="space-y-2">
              {w.items.map(it => (
                <li key={it.id} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="w-10 shrink-0 mt-0.5 text-xs font-semibold text-gray-600">{dayLabel(it.plan_date)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 break-words">{it.description}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 break-words">
                      {it.subject}{it.source ? ` · ${it.source}` : ''}
                    </p>
                    {it.note && <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap break-words">Not: {it.note}</p>}
                  </div>
                  <span className={`border rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${BADGE_COLOR[it.status]}`}>
                    {PLAN_STATUS_LABELS[it.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
