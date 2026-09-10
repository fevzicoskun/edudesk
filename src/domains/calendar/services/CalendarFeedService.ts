import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { createStableToken, generateJti, verifyPublicToken } from '@/src/infrastructure/tokens'
import { logger } from '@/src/infrastructure/observability/logger'
import { addDaysISO, todayLocalISO } from '@/src/shared/date'
import { CalendarService } from './CalendarService'
import { evaluateFeedAccess } from '../feedAccess'
import { buildIcsCalendar } from '../ics'

// Takvim aboneliği (ICS) — token tasarımı:
//   token = HMAC imzalı v1 token { t:'takvim', id:userId, jti:ics_key, exp:2100, m:{school_id} } (deterministik → URL sabit)
//   ics_key = auth.users.app_metadata.ics_key (128-bit rastgele; yalnız service-role yazabilir)
//   iptal  = "Bağlantıyı yenile" → yeni ics_key; eski token'ın jti'si artık eşleşmez → 404.
// Yeni tablo/migration yok. revoked_tokens bilinçli kullanılmadı (30 günde pg_cron ile temizleniyor).

export const ICS_PAST_DAYS = 30
export const ICS_FUTURE_DAYS = 90

export type FeedRender = { status: 200; body: string } | { status: 403 | 404 }

function storedKeyOf(appMetadata: Record<string, unknown> | undefined): string | null {
  const key = appMetadata?.ics_key
  return typeof key === 'string' && key.length > 0 ? key : null
}

async function buildFeedUrl(userId: string, schoolId: string, key: string): Promise<string> {
  const token = await createStableToken('takvim', userId, key, { school_id: schoolId })
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'
  return `${base}/api/takvim/ics?t=${token}` // token b64url + '.' → URL-güvenli
}

export const CalendarFeedService = {
  /** Oturumdaki kullanıcının abonelik URL'si; henüz oluşturmadıysa null. */
  async getMyFeedUrl(): Promise<string | null> {
    const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
    if (!user || !profile?.school_id) return null
    const key = storedKeyOf(user.app_metadata)
    return key ? buildFeedUrl(user.id, profile.school_id, key) : null
  },

  /** Yeni anahtar üretir (ilk oluşturma veya yenileme). Eski URL anında geçersizleşir. */
  async rotateMyFeedUrl(): Promise<{ url?: string; error?: string }> {
    const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
    if (!user || !profile?.school_id) return { error: 'Giriş gerekli' }

    const key = generateJti()
    // app_metadata: kullanıcı kendi user_metadata'sını değiştirebilir, app_metadata'yı değil → service-role.
    // GoTrue app_metadata güncellemesini anahtar bazında birleştirir (provider alanları korunur).
    const { error } = await createServiceClient().auth.admin.updateUserById(user.id, { app_metadata: { ics_key: key } })
    if (error) {
      logger.error({ event: 'takvim_ics_key_rotate_failed', userId: user.id, err: error.message }, 'Takvim abonelik anahtarı yazılamadı')
      return { error: 'Bağlantı oluşturulamadı' }
    }
    return { url: await buildFeedUrl(user.id, profile.school_id, key) }
  },

  /** Çerezsiz istek: token → kullanıcı/okul bağlamı → ortak birleştirme → ICS. */
  async renderFeed(token: string): Promise<FeedRender> {
    const verified = await verifyPublicToken(token, 'takvim')
    if (!verified.ok) return { status: 404 }
    const { payload } = verified

    const db = createServiceClient()
    const [userRes, profileRes] = await Promise.all([
      db.auth.admin.getUserById(payload.id),
      db.from('profiles').select('school_id, role, schools(status, access_until)').eq('id', payload.id).maybeSingle(),
    ])
    // Silinmiş kullanıcı → 404. Geçici altyapı hatası → throw (route 500 döner; takvim uygulaması önbelleği korur).
    if (userRes.error && userRes.error.status !== 404) throw new Error(`auth getUserById: ${userRes.error.message}`)
    if (profileRes.error) throw new Error(`profiles: ${profileRes.error.message}`)

    const today = todayLocalISO()
    const access = evaluateFeedAccess({
      payload,
      storedKey: storedKeyOf(userRes.data.user?.app_metadata),
      profile: profileRes.data,
      today,
    })
    if (!access.ok) return { status: access.reason === 'locked' ? 403 : 404 }

    const events = await CalendarService.collectEvents(
      db, access.scope, addDaysISO(today, -ICS_PAST_DAYS), addDaysISO(today, ICS_FUTURE_DAYS),
    )
    return { status: 200, body: buildIcsCalendar(events, new Date()) }
  },
}
