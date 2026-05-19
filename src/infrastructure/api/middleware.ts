import { NextRequest, NextResponse } from 'next/server'
import { newRequestId } from '@/src/infrastructure/observability/tracing'
import { logger } from '@/src/infrastructure/observability/logger'
import { withCorrelationId } from '@/src/infrastructure/observability/correlation'
import { getAbility } from '@/src/shared/authorization/server'
import { translateError } from '@/src/shared/errors'
import type { Ability } from '@/src/shared/authorization'
import type { PermissionKey } from '@/src/shared/permissions'
import { apiErr, type MetaCtx } from './response'

// ─── Handler context ──────────────────────────────────────────────────────────

export interface InternalContext extends MetaCtx {
  readonly ability: Ability
}

// RouteHandler intentionally unparameterised — multi-branch handlers return
// different data shapes; typing through NextResponse<T> is invariant so it
// would force casts everywhere. API contract lives in docs/internal-api.md.
type RouteHandler = (req: NextRequest, ctx: InternalContext) => Promise<NextResponse>

// ─── withInternalAuth ─────────────────────────────────────────────────────────
//
// Wraps a Next.js route handler with:
//   - Auth check via Ability engine
//   - Optional permission guard (null = any authenticated user)
//   - Request tracing: X-Request-ID + X-Duration-Ms headers
//   - Structured logging per request
//   - Top-level error boundary + Turkish error translation

export function withInternalAuth(perm: PermissionKey | null, handler: RouteHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = newRequestId()
    const startedAt = Date.now()
    const meta: MetaCtx = { requestId, startedAt }

    try {
      const ability = await getAbility()

      if (!ability) {
        return NextResponse.json(apiErr('UNAUTHENTICATED', 'Giriş gerekli', meta), { status: 401 })
      }

      if (perm !== null && ability.cannot(perm)) {
        return NextResponse.json(apiErr('UNAUTHORIZED', 'Yetki yok', meta), { status: 403 })
      }

      const res = await withCorrelationId(requestId, () => handler(req, { ability, requestId, startedAt }))

      res.headers.set('X-Request-ID', requestId)
      res.headers.set('X-Duration-Ms', String(Date.now() - startedAt))

      logger.info({
        request_id:  requestId,
        path:        req.nextUrl.pathname,
        method:      req.method,
        duration_ms: Date.now() - startedAt,
        user_id:     ability.userId,
        school_id:   ability.schoolId,
        status:      res.status,
      }, 'internal api request')

      return res

    } catch (e) {
      const raw     = e instanceof Error ? e.message : String(e ?? '')
      const message = translateError(e)

      logger.error({
        request_id: requestId,
        path:       req.nextUrl.pathname,
        method:     req.method,
        error:      raw,
      }, 'internal api unhandled error')

      return NextResponse.json(apiErr('INTERNAL_ERROR', message, meta), { status: 500 })
    }
  }
}
