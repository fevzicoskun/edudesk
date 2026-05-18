/**
 * POST   /api/export           — enqueue async export job (202 + jobId)
 * GET    /api/export?jobId=    — poll job status + progress
 * DELETE /api/export?jobId=    — cancel a pending/processing job
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireSchoolId } from '@/src/shared/auth'
import { UUID } from '@/src/shared/validation'
import { ExportService } from '@/src/domains/export/services/ExportService'
import { ExportRepository } from '@/src/domains/export/repositories/ExportRepository'
import type { JobType } from '@/src/domains/export/types'

const ALLOWED_JOB_TYPES: JobType[] = [
  'excel_odevler',
  'excel_yoklama',
  'excel_mufredat',
  'excel_notlar',
]

// ─── POST — enqueue ───────────────────────────────────────────

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
    return NextResponse.json({ error: 'Geçersiz iş türü' }, { status: 400 })
  }

  let schoolId: string
  try {
    schoolId = await requireSchoolId()
  } catch {
    return NextResponse.json({ error: 'Okul bilgisi eksik' }, { status: 403 })
  }

  const result = await ExportService.enqueue(
    jobType,
    body.params ?? {},
    user.id,
    schoolId
  )

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ jobId: result.jobId }, { status: 202 })
}

// ─── GET — poll ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId gerekli' }, { status: 400 })

  try { UUID.parse(jobId) } catch {
    return NextResponse.json({ error: 'Geçersiz jobId' }, { status: 400 })
  }

  const { data, error } = await ExportRepository.findById(jobId, user.id)
  if (error || !data) return NextResponse.json({ error: 'İş bulunamadı' }, { status: 404 })

  return NextResponse.json({
    id:            data.id,
    status:        data.status,
    progress:      data.progress,
    progress_step: data.progress_step,
    result_url:    data.result_url,
    error_msg:     data.error_msg,
    job_type:      data.job_type,
    created_at:    data.created_at,
    updated_at:    data.updated_at,
  })
}

// ─── DELETE — cancel ──────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId gerekli' }, { status: 400 })

  try { UUID.parse(jobId) } catch {
    return NextResponse.json({ error: 'Geçersiz jobId' }, { status: 400 })
  }

  const result = await ExportService.cancel(jobId, user.id)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ ok: true })
}
