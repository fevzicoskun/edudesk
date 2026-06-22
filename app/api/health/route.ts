import { NextResponse } from 'next/server'
import { logger } from '@/src/infrastructure/observability/logger'

// Public endpoint: durum + latency döner. Ham hata detayı public gövdeye konmaz —
// gerçek sebep (timeout/HTTP kodu/exception) sunucu loglarında tutulur.

export const dynamic = 'force-dynamic'

const INSTANCE_START = Date.now()

export async function GET() {
  const begin = Date.now()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  let dbStatus: 'ok' | 'error' = 'error'
  let dbLatencyMs: number | null = null
  let dbError: string | undefined // sadece loglama için — public gövdeye konmaz

  if (supabaseUrl && anonKey) {
    const dbStart = Date.now()
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: anonKey },
        signal:  AbortSignal.timeout(3_000),
      })
      dbLatencyMs = Date.now() - dbStart
      dbStatus    = res.status < 500 ? 'ok' : 'error'
      if (res.status >= 500) dbError = `HTTP ${res.status}`
    } catch (e) {
      dbLatencyMs = Date.now() - dbStart
      dbError     = e instanceof Error ? e.message : 'unreachable'
    }
  } else {
    dbError = 'missing env'
  }

  const healthy    = dbStatus === 'ok'
  const durationMs = Date.now() - begin

  if (!healthy) {
    logger.warn(
      { event: 'health_degraded', db_status: dbStatus, db_latency_ms: dbLatencyMs, db_error: dbError },
      'Health check degraded'
    )
  }

  const body = {
    status:      healthy ? 'healthy' : 'degraded',
    instance_age_ms: Date.now() - INSTANCE_START,
    duration_ms: durationMs,
    checks: {
      db: {
        status:     dbStatus,
        latency_ms: dbLatencyMs,
      },
    },
  }

  return NextResponse.json(body, { status: healthy ? 200 : 503 })
}
