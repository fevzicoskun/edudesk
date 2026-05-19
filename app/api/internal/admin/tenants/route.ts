import { NextRequest, NextResponse } from 'next/server'
import { TenantService } from '@/src/domains/admin/services/TenantService'
import { jsonOk, jsonErr, type MetaCtx } from '@/src/infrastructure/api/response'
import { logger } from '@/src/infrastructure/observability/logger'
import { newRequestId } from '@/src/infrastructure/observability/tracing/index'
import { requirePlatformAdmin } from '@/src/infrastructure/api/platformAuth'

export const dynamic = 'force-dynamic'

// GET /api/internal/admin/tenants — list all schools with metrics
export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = newRequestId()
  const startedAt = Date.now()
  const meta: MetaCtx = { requestId, startedAt }

  const adminId = await requirePlatformAdmin(req)
  if (!adminId) return jsonErr('UNAUTHORIZED', 'Platform admin erişimi gerekli', meta, 403)

  const tenants = await TenantService.listAll()

  logger.info({ admin_id: adminId, count: tenants.length }, 'platform admin: tenants listed')

  return jsonOk({ tenants }, meta)
}
