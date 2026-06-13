import Link from 'next/link'
import type { RiskAlert } from '@/src/domains/dashboard/types'

type RiskLevel = RiskAlert['riskLevel']

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    high: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      label: 'Yüksek Risk',
    },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ),
      label: 'Orta Risk',
    },
    low: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      ),
      label: 'Dikkat',
    },
  }
  const { bg, text, icon, label } = config[level]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {icon}
      {label}
    </span>
  )
}

export default function RiskUyarilariWidget({ alerts }: { alerts: RiskAlert[] }) {
  const displayed  = alerts.slice(0, 5)
  const highCount  = alerts.filter(a => a.riskLevel === 'high').length

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Risk Uyarıları</h2>
          {highCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
              {highCount} yüksek risk
            </span>
          )}
        </div>
        {alerts.length > 5 && (
          <Link href="/siniflar" className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {alerts.length} öğrenci →
          </Link>
        )}
      </header>

      {displayed.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">
          Riskli öğrenci yok. Her şey yolunda!
        </p>
      ) : (
        <ul className="space-y-2">
          {displayed.map(alert => (
            <li key={alert.studentId}>
              <Link
                href={`/siniflar/${alert.classId}/ogrenciler/${alert.studentId}`}
                className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                      {alert.studentName}
                    </span>
                    <RiskBadge level={alert.riskLevel} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {alert.className} · {alert.reasons.join(' · ')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
          {alerts.length > 5 && (
            <li>
              <Link
                href="/siniflar"
                className="flex items-center justify-center gap-1 py-2 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                + {alerts.length - 5} öğrenci daha · Tümünü gör →
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
