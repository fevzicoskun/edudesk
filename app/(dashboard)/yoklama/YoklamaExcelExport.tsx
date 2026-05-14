'use client'

import * as XLSX from 'xlsx'

const STATUS_TR: Record<string, string> = {
  present: 'Var',
  absent: 'Yok',
  late: 'Geç',
  excused: 'Mazeretli',
}

interface Student { id: string; full_name: string; student_number: string | null }
interface AttendanceRecord { student_id: string; date: string; status: string }

interface Props {
  students: Student[]
  allRecords: AttendanceRecord[]
  className: string
}

export default function YoklamaExcelExport({ students, allRecords, className }: Props) {
  const exportToExcel = () => {
    const dates = [...new Set(allRecords.map(r => r.date))].sort()

    const lookup = new Map<string, Map<string, string>>()
    for (const r of allRecords) {
      if (!lookup.has(r.student_id)) lookup.set(r.student_id, new Map())
      lookup.get(r.student_id)!.set(r.date, r.status)
    }

    const header = ['No', 'Ad Soyad', ...dates, 'Toplam Devamsızlık']
    const rows = students.map((s, i) => {
      let devamsizlik = 0
      const statusCells = dates.map(d => {
        const st = lookup.get(s.id)?.get(d) ?? ''
        if (st === 'absent') devamsizlik += 1
        if (st === 'late') devamsizlik += 0.5
        return STATUS_TR[st] ?? ''
      })
      return [i + 1, s.full_name, ...statusCells, devamsizlik]
    })

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

    ws['!cols'] = [
      { wch: 4 },
      { wch: 24 },
      ...dates.map(() => ({ wch: 12 })),
      { wch: 18 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Yoklama')
    XLSX.writeFile(wb, `${className}_yoklama.xlsx`)
  }

  return (
    <button
      onClick={exportToExcel}
      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:text-green-700 dark:hover:text-green-400 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Excel İndir
    </button>
  )
}
