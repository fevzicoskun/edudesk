'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

interface DataRow {
  name: string
  value: number
  color: string
}

interface TrendRow {
  hafta: string
  tamamlama: number
}

interface ExportButtonsProps {
  odevTamamlama: DataRow[]
  devamsizlik: DataRow[]
  haftalikTrend: TrendRow[]
  notOrtalaması: number | null
  studentName: string
}

export default function ExportButtons({
  odevTamamlama,
  devamsizlik,
  haftalikTrend,
  notOrtalaması,
  studentName,
}: ExportButtonsProps) {
  const [xlsxLoading, setXlsxLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  function handleXlsx() {
    setXlsxLoading(true)
    try {
      const wb = XLSX.utils.book_new()

      const ozet = [
        { 'Metrik': 'Not Ortalaması', 'Değer': notOrtalaması ?? '—' },
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ozet), 'Özet')

      if (odevTamamlama.length) {
        const odevRows = odevTamamlama.map(d => ({ 'Durum': d.name, 'Sayı': d.value }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(odevRows), 'Ödev Tamamlama')
      }

      if (devamsizlik.length) {
        const devRows = devamsizlik.map(d => ({ 'Durum': d.name, 'Gün': d.value }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(devRows), 'Devamsızlık')
      }

      if (haftalikTrend.length) {
        const trendRows = haftalikTrend.map(t => ({ 'Hafta': t.hafta, 'Tamamlama %': t.tamamlama }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendRows), 'Haftalık Trend')
      }

      const date = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `ogrenci-raporu-${studentName.replace(/\s+/g, '-')}-${date}.xlsx`)
    } finally {
      setXlsxLoading(false)
    }
  }

  async function handlePdf() {
    setPdfLoading(true)
    try {
      const { createDoc } = await import('@/src/lib/createPdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = await createDoc()
      const date = new Date().toLocaleDateString('tr-TR')

      doc.setFontSize(16)
      doc.text(`Öğrenci Raporu: ${studentName}`, 14, 18)
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Oluşturulma: ${date}`, 14, 26)
      doc.setTextColor(0)

      let y = 34

      if (notOrtalaması !== null) {
        doc.setFontSize(11)
        doc.text(`Not Ortalaması: ${notOrtalaması}`, 14, y)
        y += 10
      }

      if (odevTamamlama.length) {
        autoTable(doc, {
          head: [['Durum', 'Sayı']],
          body: odevTamamlama.map(d => [d.name, d.value]),
          startY: y,
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable?.finalY ?? y + 20
        y += 6
      }

      if (devamsizlik.length) {
        autoTable(doc, {
          head: [['Devamsızlık Durumu', 'Gün']],
          body: devamsizlik.map(d => [d.name, d.value]),
          startY: y,
          headStyles: { fillColor: [16, 185, 129] },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable?.finalY ?? y + 20
        y += 6
      }

      if (haftalikTrend.length) {
        autoTable(doc, {
          head: [['Hafta', 'Tamamlama %']],
          body: haftalikTrend.map(t => [t.hafta, `%${t.tamamlama}`]),
          startY: y,
          headStyles: { fillColor: [139, 92, 246] },
          margin: { left: 14, right: 14 },
        })
      }

      doc.save(`ogrenci-raporu-${studentName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleXlsx}
        disabled={xlsxLoading}
        className="flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
      >
        <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {xlsxLoading ? 'İndiriliyor…' : 'Excel İndir'}
      </button>
      <button
        onClick={handlePdf}
        disabled={pdfLoading}
        className="flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
      >
        <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        {pdfLoading ? 'Hazırlanıyor…' : 'PDF İndir'}
      </button>
    </div>
  )
}
