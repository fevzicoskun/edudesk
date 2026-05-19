import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { TenantService } from '@/src/domains/admin/services/TenantService'
import { QuotaService } from '@/src/domains/admin/services/QuotaService'
import { jsonOk, jsonErr, type MetaCtx } from '@/src/infrastructure/api/response'
import { logger } from '@/src/infrastructure/observability/logger'
import { newRequestId } from '@/src/infrastructure/observability/tracing/index'
import { parseBody } from '@/src/infrastructure/api/validation'
import { requirePlatformAdmin } from '@/src/infrastructure/api/platformAuth'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/internal/admin/:schoolId — single tenant metrics
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> },
): Promise<NextResponse> {
  const requestId = newRequestId()
  const startedAt = Date.now()
  const meta: MetaCtx = { requestId, startedAt }

  const adminId = await requirePlatformAdmin(req)
  if (!adminId) return jsonErr('UNAUTHORIZED', 'Platform admin erişimi gerekli', meta, 403)

  const { schoolId } = await params

  if (!UUID_RE.test(schoolId)) {
    return jsonErr('VALIDATION_ERROR', 'Geçersiz okul ID', meta, 400)
  }

  const tenant = await TenantService.getOne(schoolId)
  if (!tenant) return jsonErr('NOT_FOUND', 'Okul bulunamadı', meta, 404)

  const quota = await QuotaService.checkTeacherQuota(schoolId)

  return jsonOk({ tenant, quota }, meta)
}

// PATCH /api/internal/admin/:schoolId — suspend/activate/plan/quota
const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('suspend'),
    reason: z.string().min(1),
  }),
  z.object({
    action: z.literal('activate'),
  }),
  z.object({
    action: z.literal('set_plan'),
    plan:   z.enum(['free', 'starter', 'pro', 'enterprise']),
  }),
  z.object({
    action:          z.literal('set_quota'),
    max_teachers:    z.number().int().positive().optional(),
    max_students:    z.number().int().positive().optional(),
    max_storage_mb:  z.number().int().positive().optional(),
  }).refine(
    d => d.max_teachers != null || d.max_students != null || d.max_storage_mb != null,
    { message: 'En az bir kota alanı gerekli' }
  ),
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> },
): Promise<NextResponse> {
  const requestId = newRequestId()
  const startedAt = Date.now()
  const meta: MetaCtx = { requestId, startedAt }

  const adminId = await requirePlatformAdmin(req)
  if (!adminId) return jsonErr('UNAUTHORIZED', 'Platform admin erişimi gerekli', meta, 403)

  const { schoolId } = await params

  if (!UUID_RE.test(schoolId)) {
    return jsonErr('VALIDATION_ERROR', 'Geçersiz okul ID', meta, 400)
  }

  const parsed = await parseBody<z.infer<typeof PatchSchema>>(req, PatchSchema)
  if (!parsed.success) return jsonErr('VALIDATION_ERROR', parsed.error, meta, 400)

  const { action } = parsed.data

  switch (action) {
    case 'suspend':
      await TenantService.suspend(schoolId, adminId, parsed.data.reason)
      logger.info({ school_id: schoolId, admin_id: adminId }, 'tenant: suspended via API')
      return jsonOk({ schoolId, status: 'suspended' }, meta)

    case 'activate':
      await TenantService.activate(schoolId, adminId)
      logger.info({ school_id: schoolId, admin_id: adminId }, 'tenant: activated via API')
      return jsonOk({ schoolId, status: 'active' }, meta)

    case 'set_plan':
      await TenantService.changePlan(schoolId, parsed.data.plan, adminId)
      return jsonOk({ schoolId, plan: parsed.data.plan }, meta)

    case 'set_quota':
      await QuotaService.setQuotaLimits(schoolId, {
        max_teachers:   parsed.data.max_teachers,
        max_students:   parsed.data.max_students,
        max_storage_mb: parsed.data.max_storage_mb,
      })
      return jsonOk({ schoolId, updated: true }, meta)
  }
}
