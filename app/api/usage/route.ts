import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/src/infrastructure/supabase/server'
import { FEATURES } from '@/src/shared/usage/featureMap'
import { logger } from '@/src/infrastructure/observability/logger'

const bodySchema = z.object({ feature: z.enum(FEATURES) }).strict()

// Kullanım beacon'ı — her durumda 204: metrik yazımı hiçbir istemci akışını kırmaz.
// Kimlik (user/school/role) istemciden alınmaz; increment_usage RPC auth.uid()'den türetir.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return new NextResponse(null, { status: 204 })

  const supabase = await createClient()
  const { error } = await supabase.rpc('increment_usage', { p_feature: parsed.data.feature })
  if (error) {
    logger.warn({ event: 'usage_beacon_failed', err: error.message }, 'Kullanım metriği yazılamadı')
  }
  return new NextResponse(null, { status: 204 })
}
