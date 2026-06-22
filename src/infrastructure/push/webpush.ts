import webpush from 'web-push'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { logger } from '@/src/infrastructure/observability/logger'

let vapidInitialized = false

function initVapid() {
  if (vapidInitialized) return true
  const subject = process.env.VAPID_SUBJECT
  const pub     = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv    = process.env.VAPID_PRIVATE_KEY
  if (!subject || !pub || !priv) {
    logger.warn('VAPID env değişkenleri eksik — web push devre dışı')
    return false
  }
  webpush.setVapidDetails(subject, pub, priv)
  vapidInitialized = true
  return true
}

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
  if (!initVapid()) return
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
  if (!initVapid()) return
  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .eq('school_id', schoolId)

  if (!subs?.length) return

  const results = await Promise.allSettled(
    subs.map((sub: Subscription) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  )

  // Süresi dolmuş veya geçersiz subscription'ları temizle (sendPushToUser ile tutarlı)
  const expired = results
    .map((r, i) => (r.status === 'rejected' ? subs[i] : null))
    .filter(Boolean) as Subscription[]

  if (expired.length) {
    logger.warn({ event: 'push_expired', count: expired.length, school_id: schoolId }, 'Geçersiz push subscription temizleniyor')
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('school_id', schoolId)
      .in('endpoint', expired.map(s => s.endpoint))
  }
}
