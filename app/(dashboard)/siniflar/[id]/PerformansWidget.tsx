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
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Sınıf Performansı</h2>

      {/* 3 Metrik */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">%{summary.avgCompletionPct}</p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Ort. tamamlanma</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{summary.highRiskCount}</p>
          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">Yüksek risk</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{summary.totalMissingCount}</p>
          <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">Toplam eksik</p>
        </div>
      </div>

      {/* Riskli Öğrenciler */}
      {summary.riskyStudents.length > 0 && (
        <>
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-3">
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
