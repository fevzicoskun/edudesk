import { Resend } from 'resend'
import { env } from '@/src/lib/env'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY yapılandırılmamış — e-posta gönderilemez.')
    _resend = new Resend(env.RESEND_API_KEY)
  }
  return _resend
}

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

    const { error } = await getResend().emails.send(payload)
    if (error) throw new Error(error.message)
  },
}
