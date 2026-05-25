'use server'

import { mailer } from '@/src/lib/mailer'

const CATEGORY_LABELS: Record<string, string> = {
  oneri:   'Öneri',
  istek:   'İstek',
  sikayet: 'Şikayet',
}

export async function sendFeedback(formData: FormData) {
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
  } catch {
    return { ok: false, error: 'Mail gönderilemedi. Lütfen tekrar dene.' }
  }
}
