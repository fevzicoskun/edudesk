'use client'

import { useState } from 'react'

type JobType = 'excel_odevler' | 'excel_yoklama' | 'excel_notlar' | 'excel_sinif_ogrencileri'

interface ClassItem { id: string; name: string; grade: number }

interface ReportDef {
  jobType:     JobType
  label:       string
  desc:        string
  useDate:     boolean
  useClass:    boolean
}

const REPORTS: ReportDef[] = [
  { jobType: 'excel_odevler',           label: 'Ödevler',            desc: 'Ödevler ve teslim durumları',         useDate: true,  useClass: true  },
  { jobType: 'excel_yoklama',           label: 'Yoklama',            desc: 'Devamsızlık kayıtları',               useDate: true,  useClass: true  },
  { jobType: 'excel_sinif_ogrencileri', label: 'Sınıf Öğrencileri', desc: 'Tüm sınıflardaki öğrenci listeleri', useDate: false, useClass: true  },
  { jobType: 'excel_notlar',            label: 'Öğrenci Notları',   desc: 'Öğrenciler hakkındaki notlar',        useDate: false, useClass: false },
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

export default function ExportPanel({ classes }: { classes: ClassItem[] }) {
  const [classId, setClassId] = useState('')
  const [since,   setSince]   = useState('')
  const [until,   setUntil]   = useState('')
  const [loading, setLoading] = useState<JobType | null>(null)
  const [errors,  setErrors]  = useState<Partial<Record<JobType, string>>>({})

  const inputCls = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  async function handleDownload(r: ReportDef) {
    setLoading(r.jobType)
    setErrors(prev => ({ ...prev, [r.jobType]: undefined }))

    const params: Record<string, string> = {}
    if (r.useClass && classId) params.classId = classId
    if (r.useDate  && since)   params.since   = since
    if (r.useDate  && until)   params.until   = until

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: r.jobType, params }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrors(prev => ({ ...prev, [r.jobType]: data.error ?? 'Dışa aktarılamadı' }))
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${r.jobType}.xlsx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setErrors(prev => ({ ...prev, [r.jobType]: 'Sunucuya bağlanılamadı' }))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Filtreler</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} className={inputCls + ' w-full'}>
              <option value="">Tüm Sınıflar</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Başlangıç</label>
            <input type="date" value={since} onChange={e => setSince(e.target.value)} className={inputCls + ' w-full'} />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Bitiş</label>
            <input type="date" value={until} onChange={e => setUntil(e.target.value)} className={inputCls + ' w-full'} />
          </div>
          {(classId || since || until) && (
            <div className="flex items-end">
              <button
                onClick={() => { setClassId(''); setSince(''); setUntil('') }}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                Temizle
              </button>
            </div>
          )}
        </div>
        {(since && until && since > until) && (
          <p className="text-xs text-red-500">Başlangıç tarihi bitiş tarihinden sonra olamaz.</p>
        )}
      </div>

      {/* Rapor Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REPORTS.map(r => {
          const activeFilters = [
            r.useClass && classId ? classes.find(c => c.id === classId)?.name : null,
            r.useDate  && since   ? since  : null,
            r.useDate  && until   ? until  : null,
          ].filter(Boolean)

          return (
            <div
              key={r.jobType}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{r.label}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{r.desc}</p>
                {activeFilters.length > 0 && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    {activeFilters.join(' · ')}
                  </p>
                )}
                {errors[r.jobType] && (
                  <p className="text-xs text-red-500 mt-1">{errors[r.jobType]}</p>
                )}
              </div>
              <button
                onClick={() => handleDownload(r)}
                disabled={loading !== null || (since !== '' && until !== '' && since > until)}
                className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 shrink-0"
              >
                {loading === r.jobType ? <SpinIcon /> : <DownloadIcon />}
                {loading === r.jobType ? 'İndiriliyor…' : 'Excel'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
