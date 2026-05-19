import { NextResponse } from 'next/server'

// Liveness: is the process alive?
// Returns 200 immediately — no dependencies checked.
// Used by load balancers to detect crashed/hung processes.

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ ok: true }, { status: 200 })
}
