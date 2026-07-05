'use server'

import { mailer } from '@/src/lib/mailer'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { feedbackSchema } from '@/src/shared/validation'
import { logger } from '@/src/infrastructure/observability/logger'

const CATEGORY_LABELS: Record<string, string> = {
  oneri:   'Öneri',
  istek:   'İstek',
  sikayet: 'Şikayet',
}

export async function sendFeedback(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Giriş yapılmamış.' }

  const profile = await getCurrentProfile()
  if (!profile?.school_id) return { ok: false, error: 'Profil bulunamadı.' }

  const parsed = feedbackSchema.safeParse({
    category:  formData.get('category'),
    message:   formData.get('message'),
    page_path: formData.get('page_path') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: 'Mesaj boş veya çok uzun.' }
  const { category, message, page_path } = parsed.data

  // Rate limit: son 60 sn'de 3+ kayıt varsa reddet.
  // feedback'te SELECT policy yok → sayım service client ile yapılır.
  const service = createServiceClient()
  const { count } = await service
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((count ?? 0) >= 3) {
    return { ok: false, error: 'Çok sık gönderiyorsun, biraz sonra tekrar dene.' }
  }

  // Asıl kalıcı kayıt: DB. SELECT policy olmadığından .select() ÇAĞRILMAZ.
  const supabase = await createClient()
  const { error } = await supabase.from('feedback').insert({
    school_id: profile.school_id,
    user_id:   user.id,
    role:      profile.role,
    page_path: page_path || '/',
    category,
    message,
  })
  if (error) {
    logger.error({ event: 'feedback_insert_failed', err: error.message }, 'Feedback kaydedilemedi')
    return { ok: false, error: 'Kaydedilemedi. Lütfen tekrar dene.' }
  }

  // Mail best-effort: DB kaydı başarılı olduğu için mail patlasa da ok döner.
  const categoryLabel = CATEGORY_LABELS[category] ?? 'Öneri'
  const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  try {
    await mailer.sendMail({
      subject: `[EduDesk] ${categoryLabel} — ${now}`,
      text: [
        `Tür: ${categoryLabel}`,
        `Sayfa: ${page_path || '-'}`,
        `Tarih: ${now}`,
        '',
        message,
      ].join('\n'),
    })
  } catch (err) {
    logger.warn({ event: 'feedback_mail_failed', err: String(err) }, 'Feedback maili gönderilemedi (kayıt DB\'de)')
  }

  return { ok: true }
}
