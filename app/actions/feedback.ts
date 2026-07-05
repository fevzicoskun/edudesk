'use server'

import { mailer } from '@/src/lib/mailer'
import { getCurrentUser } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
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

  const parsed = feedbackSchema.safeParse({
    category:  formData.get('category'),
    message:   formData.get('message'),
    page_path: formData.get('page_path') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: 'Mesaj boş veya çok uzun.' }
  const { category, message, page_path } = parsed.data

  // Asıl kalıcı kayıt: submit_feedback RPC (SECURITY DEFINER).
  // Kimlik (school_id/user_id/role) ve 3/60sn rate limit DB'de uygulanır —
  // doğrudan PostgREST insert'i kapalı (feedback'te INSERT policy yok).
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('submit_feedback', {
    p_category:  category,
    p_message:   message,
    p_page_path: page_path,
  })
  if (error) {
    logger.error({ event: 'feedback_insert_failed', err: error.message }, 'Feedback kaydedilemedi')
    return { ok: false, error: 'Kaydedilemedi. Lütfen tekrar dene.' }
  }
  if (result === 'rate_limited') {
    return { ok: false, error: 'Çok sık gönderiyorsun, biraz sonra tekrar dene.' }
  }
  if (result !== 'ok') {
    return { ok: false, error: 'Profil bulunamadı.' }
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
