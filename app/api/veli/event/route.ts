import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { verifyPublicToken, isTokenRevoked, looksLikeToken } from '@/src/infrastructure/tokens'

const VALID_EVENT_TYPES = ['page_view', 'section_view', 'session_end'] as const
const VALID_SECTIONS    = ['odevler', 'devamsizlik', 'notlar'] as const

type EventType = typeof VALID_EVENT_TYPES[number]
type Section   = typeof VALID_SECTIONS[number]

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const { token, event_type, section, duration_sec } = body

  if (typeof token !== 'string' || !looksLikeToken(token)) {
    return NextResponse.json({ error: 'Geçersiz token' }, { status: 400 })
  }

  if (!VALID_EVENT_TYPES.includes(event_type as EventType)) {
    return NextResponse.json({ error: 'Geçersiz event_type' }, { status: 400 })
  }

  if (event_type === 'section_view' && !VALID_SECTIONS.includes(section as Section)) {
    return NextResponse.json({ error: 'Geçersiz section' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const result   = await verifyPublicToken(token, 'veli')
  if (!result.ok) return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 })

  const revoked = await isTokenRevoked(result.payload.jti, supabase)
  if (revoked) return NextResponse.json({ error: 'Token iptal edilmiş' }, { status: 401 })

  const schoolId = result.payload.m?.school_id
  if (!schoolId) return NextResponse.json({ error: 'Eksik school_id' }, { status: 400 })

  const durationSec =
    event_type === 'session_end' && typeof duration_sec === 'number'
      ? Math.min(Math.max(0, Math.round(duration_sec)), 7200)
      : null

  await supabase.from('veli_portal_events').insert({
    token_jti:    result.payload.jti,
    student_id:   result.payload.id,
    school_id:    schoolId,
    event_type:   event_type as string,
    section:      event_type === 'section_view' ? (section as string) : null,
    duration_sec: durationSec,
  })

  return NextResponse.json({ ok: true })
}
