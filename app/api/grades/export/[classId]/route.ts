import { NextRequest, NextResponse } from 'next/server'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { GradeRepository } from '@/src/domains/grades/repositories/GradeRepository'
import { buildXlsx } from '@/src/domains/export/services/XlsxBuilder'
import type { GradeColumn } from '@/src/domains/grades/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
): Promise<NextResponse> {
  const ability = await getAbility()
  if (!ability) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ability.cannot(P.GRADES.READ)) return NextResponse.json({ error: 'Yetki yok' }, { status: 403 })

  const { classId } = await params

  const { data: cols, error: colErr } = await GradeRepository.findColumnsByClass(classId, ability.schoolId)
  if (colErr) return NextResponse.json({ error: colErr.message }, { status: 500 })
  if (!cols?.length) {
    const empty = await buildXlsx([{ 'Bilgi': 'Henüz ölçme eklenmedi' }], 'excel_not_defteri')
    return xlsxResponse(empty, `not-defteri-${classId}.xlsx`)
  }

  const { data: entries, error: entryErr } = await GradeRepository.findEntriesByClass(classId, ability.schoolId)
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 })

  const scoreIndex = new Map<string, Map<string, number | null>>()
  for (const e of entries ?? []) {
    if (!scoreIndex.has(e.grade_column_id)) scoreIndex.set(e.grade_column_id, new Map())
    scoreIndex.get(e.grade_column_id)!.set(e.student_id, e.score)
  }

  const studentIds = [...new Set((entries ?? []).map(e => e.student_id))]

  const rows = studentIds.map(studentId => {
    const row: Record<string, unknown> = { 'Öğrenci ID': studentId }
    for (const col of cols as GradeColumn[]) {
      const label = `${col.title} (${col.grade_type}${col.exam_date ? ' ' + col.exam_date : ''})`
      const score = scoreIndex.get(col.id)?.get(studentId)
      row[label] = score ?? ''
    }
    return row
  })

  const buffer = await buildXlsx(rows, 'excel_not_defteri')
  const date = new Date().toISOString().split('T')[0]
  return xlsxResponse(buffer, `not-defteri-${date}.xlsx`)
}

function xlsxResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
