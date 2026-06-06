'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç', mazeretli: 'Mazeretli',
}

const CELL_CLS: Record<SubmissionStatus, string> = {
  yapildi:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  eksik:     'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-400',
  yapilmadi: 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400',
  gec:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  mazeretli: 'bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-400',
}

const CELL_DOT: Record<SubmissionStatus, string> = {
  yapildi: '✓', eksik: '~', yapilmadi: '✗', gec: 'G', mazeretli: 'M',
}

function dueDateFmt(d: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM') } catch { return d }
}

function completionColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

type Student  = { id: string; full_name: string; student_number: string | null }
type Homework = { id: string; title: string; subject: string; due_date: string | null }

type Props = {
  students:   Student[]
  homeworks:  Homework[]
  subMap:     Record<string, SubmissionStatus>
  className?: string
}

const STATUS_COLOR: Record<SubmissionStatus, string> = {
  yapildi:   'FFD9EAD3',
  eksik:     'FFFFFF99',
  yapilmadi: 'FFFFE2DD',
  gec:       'FFFFF0E0',
  mazeretli: 'FFF3F3F3',
}

const PDF_COLOR: Record<SubmissionStatus, [number, number, number]> = {
  yapildi:   [217, 234, 211],
  eksik:     [255, 255, 153],
  yapilmadi: [255, 226, 221],
  gec:       [255, 240, 224],
  mazeretli: [243, 243, 243],
}

export default function MatrisClient({ students, homeworks, subMap, className }: Props) {
  const [search, setSearch]         = useState('')
  const [sortBy, setSortBy]         = useState<'number' | 'pct_desc' | 'pct_asc'>('number')
  const [exportMenu, setExportMenu] = useState(false)

  // Her iki Map tek geçişte, aynı bağımlılık dizisiyle hesaplanıyor — render'da sıfır hesap.
  const { statsMap, hwStatsMap } = useMemo(() => {
    type Stat = { done: number; eligible: number; pct: number | null }

    const byStudent: Record<string, Stat> = {}
    const byHw:      Record<string, Stat> = {}

    for (const hw of homeworks) byHw[hw.id] = { done: 0, eligible: 0, pct: null }
    for (const st of students)  byStudent[st.id] = { done: 0, eligible: 0, pct: null }

    for (const st of students) {
      for (const hw of homeworks) {
        const s = subMap[`${st.id}_${hw.id}`]
        if (!s || s === 'mazeretli') continue
        byStudent[st.id].eligible++
        byHw[hw.id].eligible++
        if (s === 'yapildi') {
          byStudent[st.id].done++
          byHw[hw.id].done++
        }
      }
    }

    const finalize = (r: Stat): Stat => ({
      ...r, pct: r.eligible === 0 ? null : Math.round(r.done / r.eligible * 100),
    })
    for (const id of Object.keys(byStudent)) byStudent[id] = finalize(byStudent[id])
    for (const id of Object.keys(byHw))      byHw[id]      = finalize(byHw[id])

    return { statsMap: byStudent, hwStatsMap: byHw }
  }, [students, homeworks, subMap])

  async function exportToExcel() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const safeClassName = (className ?? 'Sinif').replace(/[*?:\\/[\]]/g, '-')
    const ws = wb.addWorksheet(safeClassName)

    // Tüm öğrenciler numara sırasıyla — filtre/sıralama dışında
    const allByNumber = [...students].sort((a, b) =>
      (a.student_number ?? '').localeCompare(b.student_number ?? '', undefined, { numeric: true })
    )

    // Başlık satırı
    const headerRow = ws.addRow([
      'No', 'Ad Soyad',
      ...homeworks.map(h => h.title),
      'Tamamlanma %',
    ])
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0E4F7' } }
    headerRow.alignment = { vertical: 'middle', wrapText: true }

    // Alt başlık: ders + tarih
    const subHeaderRow = ws.addRow([
      '', '',
      ...homeworks.map(h => `${h.subject} · ${dueDateFmt(h.due_date)}`),
      '',
    ])
    subHeaderRow.font = { italic: true, color: { argb: 'FF888888' } }

    // Öğrenci satırları
    for (const student of allByNumber) {
      const { pct } = statsMap[student.id]
      const dataRow = ws.addRow([
        student.student_number ?? '',
        student.full_name,
        ...homeworks.map(hw => {
          const s = subMap[`${student.id}_${hw.id}`]
          return s ? STATUS_LABEL[s] : '—'
        }),
        pct !== null ? `%${pct}` : '—',
      ])

      // Hücre renkleri
      homeworks.forEach((hw, i) => {
        const s = subMap[`${student.id}_${hw.id}`]
        if (s) {
          const cell = dataRow.getCell(i + 3)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLOR[s] } }
          cell.alignment = { horizontal: 'center' }
        }
      })
    }

    // Sınıf ortalaması satırı
    const footerRow = ws.addRow([
      '', 'Sınıf Ort.',
      ...homeworks.map(hw => {
        const { pct } = hwStatsMap[hw.id] ?? { pct: null }
        return pct !== null ? `%${pct}` : '—'
      }),
      '',
    ])
    footerRow.font = { bold: true }
    footerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } }

    // Sütun genişlikleri
    ws.getColumn(1).width = 8
    ws.getColumn(2).width = 28
    for (let i = 3; i <= homeworks.length + 2; i++) ws.getColumn(i).width = 16
    ws.getColumn(homeworks.length + 3).width = 14

    // İndir
    const buffer = await wb.xlsx.writeBuffer()
    const url = URL.createObjectURL(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeClassName}_donem_raporu.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportToPdf() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])

    // Türkçe karakter desteği için Roboto embed et
    const fontResp = await fetch('/fonts/Roboto-Regular.ttf')
    const fontBuf  = await fontResp.arrayBuffer()
    const bytes    = new Uint8Array(fontBuf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const fontB64 = btoa(binary)

    const allByNumber = [...students].sort((a, b) =>
      (a.student_number ?? '').localeCompare(b.student_number ?? '', undefined, { numeric: true })
    )
    const safeClassName = (className ?? 'Sinif').replace(/[*?:\\/[\]]/g, '-')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.addFileToVFS('Roboto-Regular.ttf', fontB64)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.setFont('Roboto', 'normal')

    const pageW  = doc.internal.pageSize.getWidth()   // 297
    const pageH  = doc.internal.pageSize.getHeight()  // 210
    const margin = 14

    // ── Üst renk bandı ──────────────────────────────────────
    doc.setFillColor(67, 97, 238)  // indigo-600
    doc.rect(0, 0, pageW, 12, 'F')

    // Bant içi: sınıf adı (sol) + EduDesk (sağ)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text(className ?? 'Sınıf', margin, 8)
    doc.setFontSize(9)
    doc.text('EduDesk', pageW - margin, 8, { align: 'right' })

    // ── Başlık alanı ─────────────────────────────────────────
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(16)
    doc.text('Dönem Raporu', margin, 22)

    const tarih = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.setFontSize(8.5)
    doc.setTextColor(110, 110, 110)
    doc.text(tarih, pageW - margin, 22, { align: 'right' })

    // Özet: öğrenci · ödev · ortalama
    const totalDone = allByNumber.reduce((s, st) => s + (statsMap[st.id]?.done ?? 0), 0)
    const totalElig = allByNumber.reduce((s, st) => s + (statsMap[st.id]?.eligible ?? 0), 0)
    const classAvg  = totalElig > 0 ? Math.round(totalDone / totalElig * 100) : 0

    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(
      `${students.length} öğrenci  ·  ${homeworks.length} ödev  ·  Ortalama tamamlanma: %${classAvg}`,
      margin, 29
    )

    // Ayırıcı çizgi
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(margin, 33, pageW - margin, 33)

    // ── Tablo ────────────────────────────────────────────────
    const usableW = pageW - margin * 2
    const noW     = 12
    const nameW   = 48
    const oranW   = 18
    const hwW     = Math.max(20, (usableW - noW - nameW - oranW) / Math.max(homeworks.length, 1))

    const head = [[
      'No', 'Ad Soyad',
      ...homeworks.map(h => `${h.subject}\n${dueDateFmt(h.due_date)}`),
      'Oran',
    ]]
    const body = allByNumber.map(student => {
      const { pct } = statsMap[student.id]
      return [
        student.student_number ?? '',
        student.full_name,
        ...homeworks.map(hw => {
          const s = subMap[`${student.id}_${hw.id}`]
          return s ? STATUS_LABEL[s] : '—'
        }),
        pct !== null ? `%${pct}` : '—',
      ]
    })
    const foot = [['', 'Sınıf Ort.', ...homeworks.map(hw => {
      const { pct } = hwStatsMap[hw.id] ?? { pct: null }
      return pct !== null ? `%${pct}` : '—'
    }), '']]

    const colStyles: Record<number, object> = {
      0: { halign: 'center', cellWidth: noW },
      1: { cellWidth: nameW },
      [homeworks.length + 2]: { halign: 'center', cellWidth: oranW },
    }
    for (let i = 0; i < homeworks.length; i++) {
      colStyles[i + 2] = { halign: 'center', cellWidth: hwW }
    }

    autoTable(doc, {
      startY: 37,
      margin: { left: margin, right: margin },
      head,
      body,
      foot,
      theme: 'grid',
      styles:           { font: 'Roboto', fontStyle: 'normal', fontSize: 8, cellPadding: 3 },
      headStyles:       { font: 'Roboto', fontStyle: 'normal', fillColor: [67, 97, 238], textColor: 255, fontSize: 8, halign: 'center', minCellHeight: 10 },
      footStyles:       { font: 'Roboto', fontStyle: 'normal', fillColor: [235, 237, 255], textColor: 50, fontSize: 8, halign: 'center' },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      columnStyles: colStyles,
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index < 2 || data.column.index > homeworks.length + 1) return
        const student = allByNumber[data.row.index]
        if (!student) return
        const hw = homeworks[data.column.index - 2]
        if (!hw) return
        const s = subMap[`${student.id}_${hw.id}`]
        if (s) data.cell.styles.fillColor = PDF_COLOR[s]
      },
    })

    // ── Alt açıklama satırı ──────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY ?? pageH - 15
    const legendY = Math.min(finalY + 6, pageH - 8)
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text(
      'Yapıldı ✓   Eksik ~   Yapılmadı ✗   Geç G   Mazeretli M   — Girilmedi',
      margin, legendY
    )

    doc.save(`${safeClassName}_donem_raporu.pdf`)
  }

  const q = search.trim().toLowerCase()

  const filteredStudents = q
    ? students.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        (s.student_number ?? '').toLowerCase().includes(q)
      )
    : students

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'number') {
      return (a.student_number ?? '').localeCompare(b.student_number ?? '', undefined, { numeric: true })
    }
    const ap = statsMap[a.id].pct
    const bp = statsMap[b.id].pct
    if (ap === null && bp === null) return 0
    if (ap === null) return 1
    if (bp === null) return -1
    return sortBy === 'pct_desc' ? bp - ap : ap - bp
  })

  const showControls = students.length > 6

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        {showControls && (
          <>
            <div className="relative flex-1 min-w-[180px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Öğrenci ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 placeholder:text-gray-400 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="py-2 px-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 transition-all"
            >
              <option value="number">Numara sırası</option>
              <option value="pct_desc">Tamamlanma ↓ (en başarılı)</option>
              <option value="pct_asc">Tamamlanma ↑ (en riskli)</option>
            </select>
          </>
        )}
        <div className="ml-auto relative">
          <button
            onClick={() => setExportMenu(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-300 bg-white dark:bg-slate-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Dönem Raporu
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {exportMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
              <button
                onClick={() => { setExportMenu(false); exportToExcel() }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
                </svg>
                Excel (.xlsx)
              </button>
              <button
                onClick={() => { setExportMenu(false); exportToPdf() }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors border-t border-gray-100 dark:border-slate-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF (.pdf)
              </button>
            </div>
          )}
        </div>
      </div>

      {q && (
        <p className="text-xs text-gray-400 mb-3 print:hidden">
          {sortedStudents.length === 0
            ? 'Sonuç bulunamadı.'
            : `${sortedStudents.length} / ${students.length} öğrenci gösteriliyor`}
        </p>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-900/50">
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-b border-r border-gray-200 dark:border-slate-700 px-3 py-3 text-left font-semibold text-gray-600 dark:text-slate-400 min-w-[180px]">
                  Öğrenci
                </th>
                {homeworks.map(hw => (
                  <th key={hw.id} className="border-b border-r border-gray-200 dark:border-slate-700 px-2 py-2 text-center font-medium text-gray-500 dark:text-slate-500 min-w-[52px] max-w-[64px]">
                    <Link
                      href={`/odevler/${hw.id}`}
                      className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title={hw.title}
                    >
                      <div className="text-[10px] font-bold text-gray-700 dark:text-slate-300 leading-tight truncate max-w-[56px]">
                        {hw.subject ?? '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                        {dueDateFmt(hw.due_date)}
                      </div>
                    </Link>
                  </th>
                ))}
                <th className="border-b border-gray-200 dark:border-slate-700 px-3 py-3 text-center font-semibold text-gray-600 dark:text-slate-400 min-w-[60px]">
                  Oran
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student, si) => {
                const { done, eligible, pct } = statsMap[student.id]
                return (
                  <tr key={student.id} className={si % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-slate-900/20'}>
                    <td className={`sticky left-0 z-10 border-r border-b border-gray-200 dark:border-slate-700 px-3 py-2 font-medium text-gray-800 dark:text-slate-200 ${si % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/70 dark:bg-slate-800/80'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {student.student_number && (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 w-6 text-right">{student.student_number}</span>
                        )}
                        <span className="truncate max-w-[130px]">{student.full_name}</span>
                      </div>
                    </td>
                    {homeworks.map(hw => {
                      const status = subMap[`${student.id}_${hw.id}`]
                      return (
                        <td key={hw.id} className="border-r border-b border-gray-100 dark:border-slate-700/60 p-1 text-center">
                          {status ? (
                            <span
                              title={STATUS_LABEL[status]}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold ${CELL_CLS[status]}`}
                            >
                              {CELL_DOT[status]}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-50 dark:bg-slate-700/40 text-gray-300 dark:text-slate-600 text-[10px]">·</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-gray-200 dark:border-slate-700 px-2 py-2 text-center">
                      {pct === null ? (
                        <span className="text-gray-300 dark:text-slate-600">—</span>
                      ) : (
                        <span className={`font-bold ${completionColor(pct)}`}>%{pct}</span>
                      )}
                      {eligible > 0 && (
                        <div className="text-[10px] text-gray-400 dark:text-slate-500">{done}/{eligible}</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-slate-900/50 border-t-2 border-gray-300 dark:border-slate-600">
                <td className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-r border-gray-200 dark:border-slate-700 px-3 py-2 font-semibold text-gray-600 dark:text-slate-400 text-[11px]">
                  Sınıf ortalaması
                </td>
                {homeworks.map(hw => {
                  const { pct } = hwStatsMap[hw.id] ?? { pct: null }
                  return (
                    <td key={hw.id} className="border-r border-gray-200 dark:border-slate-700 px-2 py-2 text-center">
                      {pct === null ? (
                        <span className="text-gray-300 dark:text-slate-600 text-[10px]">—</span>
                      ) : (
                        <span className={`font-bold text-[11px] ${completionColor(pct)}`}>%{pct}</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-gray-100 dark:border-slate-700 print:hidden">
          {(Object.entries(CELL_DOT) as [SubmissionStatus, string][]).map(([s, dot]) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${CELL_CLS[s]}`}>{dot}</span>
              {STATUS_LABEL[s]}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-50 dark:bg-slate-700/40 text-gray-300 dark:text-slate-600">·</span>
            Girilmedi
          </span>
        </div>
      </div>
    </>
  )
}
