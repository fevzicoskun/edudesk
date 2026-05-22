'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'

type RiskLevel = 'high' | 'medium' | 'low'

type RiskAlert = {
  id: string
  studentName: string
  studentId: string
  className: string
  riskLevel: RiskLevel
  reason: string
  daysAgo: number
}

// Fake data - sonra gerçek veri ile değiştirilecek
const fakeRiskAlerts: RiskAlert[] = [
  {
    id: '1',
    studentName: 'Ahmet Yılmaz',
    studentId: 'student-1',
    className: '9-A',
    riskLevel: 'high',
    reason: '3 haftadır ödev yapmıyor',
    daysAgo: 5,
  },
  {
    id: '2',
    studentName: 'Ayşe Demir',
    studentId: 'student-2',
    className: '10-B',
    riskLevel: 'medium',
    reason: 'Notları %15 düştü',
    daysAgo: 2,
  },
  {
    id: '3',
    studentName: 'Mehmet Kaya',
    studentId: 'student-3',
    className: '11-A',
    riskLevel: 'low',
    reason: 'Yoklama sorunu başladı',
    daysAgo: 1,
  },
]

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    high: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      icon: AlertTriangle,
      label: 'Yüksek Risk',
    },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      icon: AlertCircle,
      label: 'Orta Risk',
    },
    low: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      icon: Info,
      label: 'Düşük Risk',
    },
  }

  const { bg, text, icon: Icon, label } = config[level]

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

export default function RiskUyarilariWidget() {
  const [showAll, setShowAll] = useState(false)

  const displayedAlerts = showAll ? fakeRiskAlerts : fakeRiskAlerts.slice(0, 3)
  const highRiskCount = fakeRiskAlerts.filter(a => a.riskLevel === 'high').length

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Risk Uyarıları
          </h2>
          {highRiskCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
              {highRiskCount} yüksek risk
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-blue-600 font-medium hover:underline"
        >
          {showAll ? 'Gizle ↑' : 'Tümü →'}
        </button>
      </header>

      {fakeRiskAlerts.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">
          🎉 Riskli öğrenci yok. Her şey yolunda!
        </p>
      ) : (
        <ul className="space-y-2">
          {displayedAlerts.map(alert => (
            <li key={alert.id}>
              <div className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                      {alert.studentName}
                    </span>
                    <RiskBadge level={alert.riskLevel} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {alert.className} · {alert.reason}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                    {alert.daysAgo === 0 ? 'bugün' : `${alert.daysAgo} gün önce`}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-3 text-center">
        ⚠️ Demo veri — Risk algoritması yakında aktif
      </p>
    </div>
  )
}