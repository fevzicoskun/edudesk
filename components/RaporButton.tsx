'use client'

import { useState } from 'react'

export type ClassOption = { id: string; name: string; grade?: number | null }

type ReportType = {
  value: string
  label: string
  hasClass: boolean
  hasDates: boolean
}

const REPORT_TYPES: ReportType[] = [
  { value: 'excel_odevler',  label: 'Ödevler (Excel)',        hasClass: true,  hasDates: true  },
  { value: 'excel_yoklama',  label: 'Yoklama (Excel)',         hasClass: true,  hasDates: true  },
  { value: 'excel_mufredat', label: 'Müfredat (Excel)',        hasClass: true,  hasDates: false },
  { value: 'excel_notlar',   label: 'Öğrenci Notları (Excel)', hasClass: false, hasDates: false },
]

function defaultDateFrom() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

function defaultDateTo() {
  return new Date().toISOString().split('T')[0]
}

export default function RaporButton({ classes = [] }: { classes?: ClassOption[] }) {
  const [open, setOpen]       = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [classId, setClassId] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo]   = useState(defaultDateTo)

  const selectedType = REPORT_TYPES.find(r => r.value === selected)

  function showsFilterPanel(type: ReportType): boolean {
    if (type.hasDates) return true
    if (type.hasClass && classes.length > 0) return true
    return false
  }

  function close() {
    setOpen(false)
    setSelected(null)
  }

  async function download(jobType: string) {
    setLoading(jobType)
    close()
    try {
      const params: Record<string, string> = {}
      if (classId) params.classId = classId
      if (dateFrom) params.since = dateFrom
      if (dateTo)   params.until = dateTo

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType, params }),
      })
      const data = await res.json()
      if (data.url) {
        const a = document.createElement('a')
        a.href = data.url
        a.download = data.filename ?? `${jobType}.xlsx`
        a.click()
      } else {
        alert(data.error ?? 'Rapor oluşturulamadı')
      }
    } catch {
      alert('Bağlantı hatası')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setSelected(null) }}
        disabled={!!loading}
        className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        {loading ? 'Hazırlanıyor…' : 'Rapor İndir'}
        {!loading && (
          <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg min-w-[220px]">

            {/* Rapor türü listesi */}
            {!selected && (
              <div className="py-1">
                {REPORT_TYPES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => {
                      if (showsFilterPanel(r)) {
                        setSelected(r.value)
                      } else {
                        download(r.value)
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between gap-2"
                  >
                    {r.label}
                    {showsFilterPanel(r) && (
                      <svg className="w-3 h-3 opacity-40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Filtre paneli */}
            {selected && selectedType && (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{selectedType.label}</p>
                </div>

                {selectedType.hasClass && classes.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
                    <select
                      value={classId}
                      onChange={e => setClassId(e.target.value)}
                      className="w-full text-xs border border-gray-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="">Tüm Sınıflar</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedType.hasDates && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-1">Başlangıç</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full text-xs border border-gray-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-1">Bitiş</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full text-xs border border-gray-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </>
                )}

                <button
                  onClick={() => download(selected)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                >
                  İndir
                </button>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}
