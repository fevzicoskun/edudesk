import webpush from 'web-push'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { logger } from '@/src/infrastructure/observability/logger'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface PushPayload {
  title: string
  body: string
  url?: string
}

interface Subscription {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  const results = await Promise.allSettled(
    subs.map((sub: Subscription) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  )

  // Süresi dolmuş veya geçersiz subscription'ları temizle
  const expired = results
    .map((r, i) => (r.status === 'rejected' ? subs[i] : null))
    .filter(Boolean) as Subscription[]

  if (expired.length) {
    logger.warn({ event: 'push_expired', count: expired.length, user_id: userId }, 'Geçersiz push subscription temizleniyor')
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('endpoint', expired.map(s => s.endpoint))
  }
}

export async function sendPushToSchool(schoolId: string, payload: PushPayload): Promise<void> {
  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .eq('school_id', schoolId)

  if (!subs?.length) return

  await Promise.allSettled(
    subs.map((sub: Subscription) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  )
}
