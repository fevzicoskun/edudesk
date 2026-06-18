import type { AttendanceKpi } from '@/src/domains/attendance/lib/analitik'

function Card({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className={`border rounded-xl p-4 ${tone}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-90">{label}</p>
    </div>
  )
}

export default function KpiOzet({ kpi }: { kpi: AttendanceKpi }) {
  const totalStr = kpi.totalUnexcused % 1 === 0 ? String(kpi.totalUnexcused) : kpi.totalUnexcused.toFixed(1)
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Card value={`${totalStr} gün`} label="Toplam özürsüz devamsızlık" tone="bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" />
      <Card value={String(kpi.overLimit)} label={`Sınırı aşan (≥20 gün)`} tone="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800" />
      <Card value={String(kpi.inWarn)} label={`Uyarı bölgesi (15–20)`} tone="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" />
      <Card value={`${kpi.takenToday}/${kpi.totalClasses}`} label="Bugün yoklama alınan sınıf" tone="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800" />
    </div>
  )
}
