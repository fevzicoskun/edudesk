import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { schoolYearStart } from '@/src/shared/utils'
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import { buildReportRows, buildExcelRows } from '@/src/domains/attendance/lib/absenceReport'

const MUDUR_ROLLER = ['mudur', 'mudur_yardimcisi']

export async function GET() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !MUDUR_ROLLER.includes(profile.role)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const db    = await createClient()
  const since = schoolYearStart()

  const [{ data: attRows }, { data: studentRows }] = await Promise.all([
    db.from('attendance')
      .select('student_id, status, date')
      .eq('school_id', profile.school_id)
      .gte('date', since)
      .neq('status', 'present'),
    db.from('students')
      .select('id, full_name, student_number, classes(name)')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null),
  ])

  const counts    = countAbsences(attRows ?? [])
  const students  = (studentRows ?? []).map(s => ({
    id:        s.id,
    fullName:  s.full_name,
    studentNo: s.student_number,
    className: (s.classes as { name: string } | null)?.name ?? '—',
  }))
  const rows      = buildReportRows(counts, students)
  const excelRows = buildExcelRows(rows)

  const workbook = new ExcelJS.Workbook()
  const sheet    = workbook.addWorksheet('Devamsızlık Raporu')

  if (excelRows.length === 0) {
    sheet.addRow(['Bilgi'])
    sheet.addRow(['Bu dönemde devamsızlık kaydı bulunmuyor.'])
  } else {
    const headers = Object.keys(excelRows[0])
    sheet.addRow(headers)
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }
    for (const row of excelRows) sheet.addRow(headers.map(h => row[h]))
    sheet.columns.forEach((col, i) => {
      const header  = headers[i] ?? ''
      const maxLen  = excelRows.slice(0, 50).reduce(
        (max, row) => Math.max(max, String(row[header] ?? '').length), 0
      )
      col.width = Math.min(50, Math.max(12, header.length, maxLen) + 2)
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="devamsizlik-raporu.xlsx"',
    },
  })
}
