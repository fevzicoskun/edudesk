'use server'

import { mailer } from '@/src/lib/mailer'
import { logger } from '@/src/infrastructure/observability/logger'
import { esc } from '@/src/lib/email-utils'
import { env } from '@/src/lib/env'

export async function applySchool(_prev: unknown, formData: FormData) {
  const schoolName   = (formData.get('school_name') as string)?.trim()
  const contactName  = (formData.get('contact_name') as string)?.trim()
  const email        = (formData.get('email') as string)?.trim()
  const phone        = (formData.get('phone') as string)?.trim()
  const note         = (formData.get('note') as string)?.trim()

  if (!schoolName || !contactName || !email) {
    return { error: 'Okul adı, yetkili adı ve e-posta zorunludur.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Geçerli bir e-posta adresi girin.' }
  }

  try {
    await mailer.sendMail({

      to: env.FEEDBACK_TO,
      subject: `Yeni Okul Başvurusu: ${schoolName}`,
      html: `
        <h2>Yeni EduDesk Okul Başvurusu</h2>
        <table cellpadding="8" style="border-collapse:collapse;font-size:14px">
          <tr><td><b>Okul Adı</b></td><td>${esc(schoolName)}</td></tr>
          <tr><td><b>Yetkili</b></td><td>${esc(contactName)}</td></tr>
          <tr><td><b>E-posta</b></td><td>${esc(email)}</td></tr>
          <tr><td><b>Telefon</b></td><td>${phone ? esc(phone) : '—'}</td></tr>
          <tr><td><b>Not</b></td><td>${note ? esc(note) : '—'}</td></tr>
        </table>
      `,
    })
    return { success: true }
  } catch (err) {
    logger.error({ event: 'kayit_mail_failed', schoolName, email, err }, 'Okul başvuru maili gönderilemedi')
    return { error: 'Mail gönderilemedi, lütfen tekrar deneyin.' }
  }
}
