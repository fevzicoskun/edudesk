import { NextResponse } from 'next/server'

// Readiness: is the system ready to serve traffic?
// Checks Supabase connectivity. Returns 503 if DB is unreachable.
// Used by load balancers before routing traffic to a new deployment.

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ ok: false, reason: 'missing env' }, { status: 503 })
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
    return NextResponse.json({ ok: false, reason: `supabase ${res.status}` }, { status: 503 })
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unreachable'
    return NextResponse.json({ ok: false, reason }, { status: 503 })
  }
}
