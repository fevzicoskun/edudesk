import { getCurrentUser } from '@/src/shared/auth'
import { TeacherDashboardService } from '@/src/domains/dashboard/services/TeacherDashboardService'
import type { RiskAlert } from '@/src/domains/dashboard/types'
import Link from 'next/link'

type RiskLevel = RiskAlert['riskLevel']

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    high:   { bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-700 dark:text-red-400',    label: 'Yüksek Risk' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Orta Risk'   },
    low:    { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   label: 'Dikkat'      },
  }
  const { bg, text, label } = config[level]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {label}
    </span>
  )
}

export default async function PerformansWidget({ classId }: { classId: string }) {
  const user = await getCurrentUser()
  if (!user) return null

  const summary = await TeacherDashboardService.getClassSummary(classId, user.id)
  if (!summary) return null

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-5">
      {/* Tek sade şerit — renk yalnız rakamda (kullanıcı renkli kutu/dashboard dilini sevmiyor) */}
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-gray-600 dark:text-slate-400">
        <span className="font-semibold text-gray-700 dark:text-slate-300">Sınıf Performansı</span>
        <span aria-hidden="true">·</span>
        <span>Ortalama tamamlanma {summary.avgCompletionPct === null
          ? <span className="text-gray-500 dark:text-slate-400">— henüz kontrol edilmedi</span>
          : <b className="font-bold text-blue-700 dark:text-blue-300">%{summary.avgCompletionPct}</b>}</span>
        <span aria-hidden="true">·</span>
        <span>Yüksek risk <b className="font-bold text-red-700 dark:text-red-400">{summary.highRiskCount}</b></span>
        <span aria-hidden="true">·</span>
        <span>Eksik <b className="font-bold text-amber-700 dark:text-amber-400">{summary.totalMissingCount}</b></span>
      </p>

      {/* Riskli Öğrenciler */}
      {summary.riskyStudents.length > 0 && (
        <>
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-4 mb-3">
            ⚠ Dikkat Gerektiren Öğrenciler
          </p>
          <ul className="space-y-2">
            {summary.riskyStudents.map(alert => (
              <li key={alert.studentId}>
                <Link
                  href={`/siniflar/${classId}/ogrenciler/${alert.studentId}`}
                  className="block border border-gray-200 dark:border-slate-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {alert.studentName}
                    </span>
                    <RiskBadge level={alert.riskLevel} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {alert.reasons.join(' · ')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
