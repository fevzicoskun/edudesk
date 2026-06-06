import { Resend } from 'resend'
import { env } from '@/src/lib/env'

const resend = new Resend(env.RESEND_API_KEY || undefined)

export const mailer = {
  async sendMail(opts: {
    from?:   string
    to?:     string
    subject: string
    text?:   string
    html?:   string
  }) {
    const to   = opts.to ?? env.FEEDBACK_TO
    const from = opts.from ?? env.RESEND_FROM

    if (!to) throw new Error('Alıcı adresi yapılandırılmamış (FEEDBACK_TO eksik).')

    const payload = {
      from,
      to:      [to],
      subject: opts.subject,
      ...(opts.html ? { html: opts.html } : { text: opts.text ?? '' }),
    }

    const { error } = await resend.emails.send(payload)
    if (error) throw new Error(error.message)
  },
}
