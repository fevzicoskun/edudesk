'use client'

import { useState } from 'react'

type JobType = 'excel_odevler' | 'excel_yoklama' | 'excel_mufredat' | 'excel_notlar' | 'excel_sinif_ogrencileri'

const REPORTS: { jobType: JobType; label: string; desc: string }[] = [
  { jobType: 'excel_odevler',          label: 'Ödevler',           desc: 'Tüm ödevler ve teslim durumları' },
  { jobType: 'excel_yoklama',          label: 'Yoklama',           desc: 'Devamsızlık kayıtları' },
  { jobType: 'excel_mufredat',         label: 'Müfredat',          desc: 'Müfredat ilerleme durumu' },
  { jobType: 'excel_notlar',           label: 'Öğrenci Notları',   desc: 'Öğrenci not kayıtları' },
  { jobType: 'excel_sinif_ogrencileri', label: 'Sınıf Öğrencileri', desc: 'Tüm sınıflardaki öğrenci listeleri' },
]

function DownloadIcon() {
  return (
    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function SpinIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

export default function ExportPanel() {
  const [loading, setLoading] = useState<JobType | null>(null)
  const [errors, setErrors] = useState<Partial<Record<JobType, string>>>({})

  async function handleDownload(jobType: JobType) {
    setLoading(jobType)
    setErrors(prev => ({ ...prev, [jobType]: undefined }))
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrors(prev => ({ ...prev, [jobType]: data.error ?? 'Dışa aktarılamadı' }))
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${jobType}.xlsx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setErrors(prev => ({ ...prev, [jobType]: 'Sunucuya bağlanılamadı' }))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {REPORTS.map(r => (
        <div
          key={r.jobType}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{r.label}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{r.desc}</p>
            {errors[r.jobType] && (
              <p className="text-xs text-red-500 mt-1">{errors[r.jobType]}</p>
            )}
          </div>
          <button
            onClick={() => handleDownload(r.jobType)}
            disabled={loading !== null}
            className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 shrink-0"
          >
            {loading === r.jobType ? <SpinIcon /> : <DownloadIcon />}
            {loading === r.jobType ? 'İndiriliyor…' : 'Excel'}
          </button>
        </div>
      ))}
    </div>
  )
}
