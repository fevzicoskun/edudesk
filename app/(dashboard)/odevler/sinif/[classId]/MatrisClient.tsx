'use client'

import { useState, useMemo } from 'react'
import type { SubmissionStatus } from '@/src/shared/types'
import MatrisToolbar from './matris/MatrisToolbar'
import MatrisTable from './matris/MatrisTable'
import { STATUS_LABEL, STATUS_COLOR, PDF_COLOR, dueDateFmt } from './matris/types'
import type { MatrisProps, StatEntry } from './matris/types'

export default function MatrisClient({ students, homeworks, subMap, className }: MatrisProps) {
  const [search, setSearch]         = useState('')
  const [sortBy, setSortBy]         = useState<'number' | 'pct_desc' | 'pct_asc'>('number')
  const [exportMenu, setExportMenu] = useState(false)

  // Her iki Map tek geçişte, aynı bağımlılık dizisiyle hesaplanıyor — render'da sıfır hesap.
  const { statsMap, hwStatsMap } = useMemo(() => {
    const byStudent: Record<string, StatEntry> = {}
    const byHw:      Record<string, StatEntry> = {}

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

    const finalize = (r: StatEntry): StatEntry => ({
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

    const headerRow = ws.addRow([
      'No', 'Ad Soyad',
      ...homeworks.map(h => h.title),
      'Tamamlanma %',
    ])
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0E4F7' } }
    headerRow.alignment = { vertical: 'middle', wrapText: true }

    const subHeaderRow = ws.addRow([
      '', '',
      ...homeworks.map(h => `${h.subject} · ${dueDateFmt(h.due_date)}`),
      '',
    ])
    subHeaderRow.font = { italic: true, color: { argb: 'FF888888' } }

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

      homeworks.forEach((hw, i) => {
        const s = subMap[`${student.id}_${hw.id}`]
        if (s) {
          const cell = dataRow.getCell(i + 3)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLOR[s] } }
          cell.alignment = { horizontal: 'center' }
        }
      })
    }

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

    ws.getColumn(1).width = 8
    ws.getColumn(2).width = 28
    for (let i = 3; i <= homeworks.length + 2; i++) ws.getColumn(i).width = 16
    ws.getColumn(homeworks.length + 3).width = 14

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
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', 'Identity-H')
    doc.setFont('Roboto', 'normal')

    const pageW  = doc.internal.pageSize.getWidth()
    const pageH  = doc.internal.pageSize.getHeight()
    const margin = 14

    doc.setFillColor(67, 97, 238)
    doc.rect(0, 0, pageW, 12, 'F')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text(className ?? 'Sınıf', margin, 8)
    doc.setFontSize(9)
    doc.text('EduDesk', pageW - margin, 8, { align: 'right' })

    doc.setTextColor(30, 30, 30)
    doc.setFontSize(16)
    doc.text('Dönem Raporu', margin, 22)

    const tarih = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.setFontSize(8.5)
    doc.setTextColor(110, 110, 110)
    doc.text(tarih, pageW - margin, 22, { align: 'right' })

    const totalDone = allByNumber.reduce((s, st) => s + (statsMap[st.id]?.done ?? 0), 0)
    const totalElig = allByNumber.reduce((s, st) => s + (statsMap[st.id]?.eligible ?? 0), 0)
    const classAvg  = totalElig > 0 ? Math.round(totalDone / totalElig * 100) : 0

    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(
      `${students.length} öğrenci  ·  ${homeworks.length} ödev  ·  Ortalama tamamlanma: %${classAvg}`,
      margin, 29
    )

    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(margin, 33, pageW - margin, 33)

    const usableW = pageW - margin * 2
    const noW = 12, nameW = 48, oranW = 18
    const hwW = Math.max(20, (usableW - noW - nameW - oranW) / Math.max(homeworks.length, 1))

    const head = [['No', 'Ad Soyad', ...homeworks.map(h => `${h.subject}\n${dueDateFmt(h.due_date)}`), 'Oran']]
    const body = allByNumber.map(student => {
      const { pct } = statsMap[student.id]
      return [
        student.student_number ?? '',
        student.full_name,
        ...homeworks.map(hw => { const s = subMap[`${student.id}_${hw.id}`]; return s ? STATUS_LABEL[s] : '—' }),
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
    for (let i = 0; i < homeworks.length; i++) colStyles[i + 2] = { halign: 'center', cellWidth: hwW }

    autoTable(doc, {
      startY: 37,
      margin: { left: margin, right: margin },
      head, body, foot,
      theme: 'grid',
      styles:             { font: 'Roboto', fontStyle: 'normal', fontSize: 8, cellPadding: 3 },
      headStyles:         { font: 'Roboto', fontStyle: 'normal', fillColor: [67, 97, 238], textColor: 255, fontSize: 8, halign: 'center', minCellHeight: 10 },
      footStyles:         { font: 'Roboto', fontStyle: 'normal', fillColor: [235, 237, 255], textColor: 50, fontSize: 8, halign: 'center' },
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

    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? pageH - 15
    const legendY = Math.min(finalY + 6, pageH - 8)
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text('Yapıldı ✓   Eksik ~   Yapılmadı ✗   Geç G   Mazeretli M   — Girilmedi', margin, legendY)

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
      <MatrisToolbar
        showControls={showControls}
        search={search}
        sortBy={sortBy}
        exportMenu={exportMenu}
        onSearchChange={setSearch}
        onSortChange={setSortBy}
        onToggleExportMenu={() => setExportMenu(v => !v)}
        onExportExcel={() => { setExportMenu(false); exportToExcel() }}
        onExportPdf={() => { setExportMenu(false); exportToPdf() }}
      />

      {q && (
        <p className="text-xs text-gray-400 mb-3 print:hidden">
          {sortedStudents.length === 0
            ? 'Sonuç bulunamadı.'
            : `${sortedStudents.length} / ${students.length} öğrenci gösteriliyor`}
        </p>
      )}

      <MatrisTable
        sortedStudents={sortedStudents}
        homeworks={homeworks}
        subMap={subMap}
        statsMap={statsMap}
        hwStatsMap={hwStatsMap}
      />
    </>
  )
}
