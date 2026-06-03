import type { KpiCards } from '@/src/domains/homework/lib/analitik'

const KPI_CONFIG: { key: keyof KpiCards; label: string; color: string; dot: string; suffix?: string }[] = [
  { key: 'totalHomeworks',     label: 'Toplam Ödev',      color: 'text-blue-600 dark:text-blue-400',       dot: 'bg-blue-500'    },
  { key: 'avgCompletionPct',   label: 'Ort. Tamamlanma',  color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', suffix: '%' },
  { key: 'riskyStudentCount',  label: 'Riskli Öğrenci',   color: 'text-red-600 dark:text-red-400',         dot: 'bg-red-500'     },
  { key: 'pendingReviewCount', label: 'Bekleyen Kontrol', color: 'text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500'   },
]

export default function AnalitikOzet({ kpi }: { kpi: KpiCards }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {KPI_CONFIG.map(({ key, label, color, dot, suffix }) => (
        <div key={key} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3.5 shadow-sm flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <div>
            <p className={`text-2xl font-bold leading-none ${color}`}>
              {kpi[key]}{suffix ?? ''}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
