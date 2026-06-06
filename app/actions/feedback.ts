'use server'

import { mailer } from '@/src/lib/mailer'
import { getCurrentUser } from '@/src/shared/auth'

const CATEGORY_LABELS: Record<string, string> = {
  oneri:   'Öneri',
  istek:   'İstek',
  sikayet: 'Şikayet',
}

export async function sendFeedback(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Giriş yapılmamış.' }

  const category = (formData.get('category') as string) ?? 'oneri'
  const message  = (formData.get('message')  as string) ?? ''

  if (!message.trim() || message.length > 2000) {
    return { ok: false, error: 'Mesaj boş veya çok uzun.' }
  }

  const categoryLabel = CATEGORY_LABELS[category] ?? 'Öneri'
  const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })

  try {
    await mailer.sendMail({
      subject: `[EduDesk] ${categoryLabel} — ${now}`,
      text: [
        `Tür: ${categoryLabel}`,
        `Tarih: ${now}`,
        '',
        message.trim(),
      ].join('\n'),
    })
    return { ok: true }
  } catch (err) {
    console.error('[FB_ERR]', String(err))
    return { ok: false, error: 'Mail gönderilemedi. Lütfen tekrar dene.' }
  }
}
