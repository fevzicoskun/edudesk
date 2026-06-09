import { NextRequest, NextResponse } from 'next/server'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { fetchRows, buildXlsx } from '@/src/domains/export/services/XlsxBuilder'
import type { JobType } from '@/src/domains/export/types'
import { logger } from '@/src/infrastructure/observability/logger'

const ALLOWED_JOB_TYPES: JobType[] = [
  'excel_odevler',
  'excel_yoklama',
  'excel_notlar',
  'excel_sinif_ogrencileri',
]

export async function POST(req: NextRequest) {
  const ability = await getAbility()
  if (!ability) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ability.cannot(P.EXPORT.CREATE)) return NextResponse.json({ error: 'Yetki yok' }, { status: 403 })

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

  const schoolId = ability.schoolId

  try {
    const rows = await fetchRows(jobType, body.params ?? {}, schoolId)
    const buffer = await buildXlsx(rows, jobType)
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
    logger.error({ event: 'export_failed', err: e instanceof Error ? e.message : String(e) }, 'Excel raporu oluşturulamadı')
    const msg = e instanceof Error ? e.message : 'Rapor oluşturulamadı'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
