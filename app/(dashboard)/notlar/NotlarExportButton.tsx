'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import type { Note } from './NotesLayout'

export default function NotlarExportButton({ notes }: { notes: Note[] }) {
  const [loading, setLoading] = useState(false)

  function handleExport() {
    setLoading(true)
    try {
      const rows = notes.map(n => ({
        'Başlık':          n.title || 'Başlıksız Not',
        'İçerik':          n.content,
        'Oluşturulma':     new Date(n.created_at).toLocaleDateString('tr-TR'),
        'Güncellenme':     new Date(n.updated_at).toLocaleDateString('tr-TR'),
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Bilgi': 'Not bulunamadı' }])

      if (rows.length) {
        ws['!cols'] = Object.keys(rows[0]).map(k => ({
          wch: Math.min(60, Math.max(k.length, ...rows.slice(0, 50).map(r => String(r[k as keyof typeof r] ?? '').length))),
        }))
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Notlarım')
      const date = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `notlarim-${date}.xlsx`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading || notes.length === 0}
      className="flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
    >
      <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {loading ? 'İndiriliyor…' : 'Excel İndir'}
    </button>
  )
}
