import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireSchoolId } from '@/src/shared/auth'
import { fetchRows, buildXlsx } from '@/src/domains/export/services/XlsxBuilder'
import type { JobType } from '@/src/domains/export/types'

const ALLOWED_JOB_TYPES: JobType[] = [
  'excel_odevler',
  'excel_yoklama',
  'excel_mufredat',
  'excel_notlar',
  'excel_sinif_ogrencileri',
]

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { jobType?: string; params?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const jobType = body.jobType as JobType
  if (!ALLOWED_JOB_TYPES.includes(jobType)) {
    return NextResponse.json({ error: 'Geçersiz rapor türü' }, { status: 400 })
  }

  let schoolId: string
  try {
    schoolId = await requireSchoolId()
  } catch {
    return NextResponse.json({ error: 'Okul bilgisi eksik' }, { status: 403 })
  }

  try {
    const rows = await fetchRows(jobType, body.params ?? {}, schoolId)
    const buffer = buildXlsx(rows, jobType)
    const date = new Date().toISOString().split('T')[0]
    const filename = `${jobType}-${date}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Rapor oluşturulamadı'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
