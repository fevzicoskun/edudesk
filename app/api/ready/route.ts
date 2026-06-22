import { NextResponse } from 'next/server'
import { logger } from '@/src/infrastructure/observability/logger'

// Readiness: is the system ready to serve traffic?
// Checks Supabase connectivity. Returns 503 if DB is unreachable.
// Used by load balancers before routing traffic to a new deployment.
// Public endpoint: gövdede ham hata detayı yok — gerçek sebep sunucu loglarında.

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !anonKey) {
    logger.error({ event: 'ready_not_ready', reason: 'missing env' }, 'Readiness başarısız')
    return NextResponse.json({ ok: false }, { status: 503 })
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: anonKey },
      signal:  AbortSignal.timeout(3_000),
    })
    // Any non-5xx response = Supabase is reachable
    if (res.status < 500) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }
    logger.warn({ event: 'ready_not_ready', reason: `supabase ${res.status}` }, 'Readiness başarısız')
    return NextResponse.json({ ok: false }, { status: 503 })
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unreachable'
    logger.warn({ event: 'ready_not_ready', reason }, 'Readiness başarısız')
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
