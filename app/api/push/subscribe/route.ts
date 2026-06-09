import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'

export async function POST(req: NextRequest) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile?.school_id) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { endpoint, keys } = body ?? {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Eksik subscription verisi' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      school_id: profile.school_id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: req.headers.get('user-agent') ?? null,
    },
    { onConflict: 'user_id,endpoint' }
  )

  if (error) {
    logger.error({ event: 'push_subscribe_failed', err: error.message }, 'Push subscription kaydedilemedi')
    return NextResponse.json({ error: 'Kayıt hatası' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { endpoint } = body ?? {}
  if (!endpoint) return NextResponse.json({ error: 'endpoint gerekli' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) {
    logger.error({ event: 'push_unsubscribe_failed', err: error.message }, 'Push subscription silinemedi')
    return NextResponse.json({ error: 'Silme hatası' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
