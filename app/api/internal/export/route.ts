import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withInternalAuth } from '@/src/infrastructure/api/middleware'
import { parseBody, parseSearchParams } from '@/src/infrastructure/api/validation'
import { apiOk, apiErr } from '@/src/infrastructure/api/response'
import { ExportService } from '@/src/domains/export/services/ExportService'
import { ExportRepository } from '@/src/domains/export/repositories/ExportRepository'
import { P } from '@/src/shared/permissions'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const JOB_TYPES = [
  'excel_odevler',
  'excel_notlar',
  'excel_sinif_ogrencileri',
] as const

const EnqueueSchema = z.object({
  jobType: z.enum(JOB_TYPES),
  params:  z.record(z.string(), z.string()).optional().default({}),
})

const StatusSchema = z.object({
  jobId: z.string().uuid('Geçersiz iş kimliği'),
})

const CancelSchema = z.object({
  jobId: z.string().uuid('Geçersiz iş kimliği'),
})

// ─── POST /api/internal/export — yeni dışa aktarma işi kuyruğa al ──────────

export const POST = withInternalAuth(P.EXPORT.CREATE, async (req, ctx) => {
  const parsed = await parseBody(req, EnqueueSchema)
  if (!parsed.success) return NextResponse.json(apiErr('VALIDATION_ERROR', parsed.error, ctx), { status: 400 })

  const result = await ExportService.enqueue(
    parsed.data.jobType,
    parsed.data.params,
    ctx.ability.userId,
    ctx.ability.schoolId,
  )

  if ('error' in result) {
    return NextResponse.json(apiErr('ENQUEUE_FAILED', result.error, ctx), { status: 422 })
  }

  return NextResponse.json(apiOk({ jobId: result.jobId }, ctx), { status: 202 })
})

// ─── GET /api/internal/export?jobId=xxx — iş durumunu sorgula ───────────────

export const GET = withInternalAuth(null, async (req, ctx) => {
  const parsed = parseSearchParams(req, StatusSchema)
  if (!parsed.success) return NextResponse.json(apiErr('VALIDATION_ERROR', parsed.error, ctx), { status: 400 })

  const { data: job } = await ExportRepository.findById(parsed.data.jobId, ctx.ability.userId)
  if (!job) return NextResponse.json(apiErr('NOT_FOUND', 'İş bulunamadı', ctx), { status: 404 })

  return NextResponse.json(apiOk({
    id:           job.id,
    status:       job.status,
    progress:     job.progress,
    progressStep: job.progress_step,
    resultUrl:    job.result_url,
    errorMsg:     job.error_msg,
    jobType:      job.job_type,
    attempt:      job.attempt,
    createdAt:    job.created_at,
    updatedAt:    job.updated_at,
  }, ctx))
})

// ─── DELETE /api/internal/export — işi iptal et ──────────────────────────────

export const DELETE = withInternalAuth(null, async (req, ctx) => {
  const parsed = await parseBody(req, CancelSchema)
  if (!parsed.success) return NextResponse.json(apiErr('VALIDATION_ERROR', parsed.error, ctx), { status: 400 })

  const result = await ExportService.cancel(parsed.data.jobId, ctx.ability.userId)
  if (result.error) return NextResponse.json(apiErr('CANCEL_FAILED', result.error, ctx), { status: 422 })

  return NextResponse.json(apiOk({ cancelled: true, jobId: parsed.data.jobId }, ctx))
})
