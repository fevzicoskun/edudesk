'use client'

import { useCallback } from 'react'
import type { SubmissionStatus } from '@/src/shared/types'
import type { StatusItem } from './statusboard/types'
import { LABELS } from './statusboard/types'

export function useExcelExport({
  homeworkTitle, className, dueDate, items, statuses, notes,
}: {
  homeworkTitle?: string
  className?: string
  dueDate?: string
  items: StatusItem[]
  statuses: Record<string, SubmissionStatus>
  notes: Record<string, string>
}) {
  return useCallback(async () => {
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Ödev Durumu')
    sheet.columns = [{ width: 6 }, { width: 12 }, { width: 26 }, { width: 16 }, { width: 40 }]

    const infoRows: [string, string][] = [
      ['Ödev', homeworkTitle ?? '—'],
      ['Sınıf', className ?? '—'],
      ['Son Teslim', dueDate ?? '—'],
      ['Tarih', new Date().toLocaleDateString('tr-TR')],
    ]
    infoRows.forEach(([label, value]) => {
      const row = sheet.addRow([label, value])
      row.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } }
      row.getCell(2).font = { bold: true }
    })

    sheet.addRow([])
    const colHeader = sheet.addRow(['No', 'Numara', 'Ad Soyad', 'Durum', 'Not'])
    colHeader.font = { bold: true }
    colHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }

    items.forEach((item, i) => {
      sheet.addRow([i + 1, item.student_number ?? '', item.full_name, LABELS[statuses[item.student_id] ?? 'yapilmadi'], notes[item.student_id] ?? ''])
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a')
    a.href = url
    a.download = homeworkTitle ? `${homeworkTitle.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '')}_odev.xlsx` : 'odev_durumu.xlsx'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }, [homeworkTitle, className, dueDate, items, statuses, notes])
}
