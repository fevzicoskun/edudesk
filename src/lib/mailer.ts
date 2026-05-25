import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM ?? 'EduDesk <noreply@myedudesk.com.tr>'

export const mailer = {
  async sendMail(opts: {
    from?:   string
    to?:     string
    subject: string
    text?:   string
    html?:   string
  }) {
    const to  = opts.to ?? process.env.FEEDBACK_TO ?? ''
    const from = opts.from ?? FROM

    if (!to) {
      console.error('[mailer] FEEDBACK_TO env var eksik veya boş!')
      throw new Error('Alıcı adresi yapılandırılmamış.')
    }

    console.log('[mailer] from:', from, '| to:', to)

    const payload = {
      from,
      to:      [to],
      subject: opts.subject,
      ...(opts.html ? { html: opts.html } : { text: opts.text ?? '' }),
    }

    const { error } = await resend.emails.send(payload)
    if (error) {
      console.error('[mailer] Resend name:', (error as { name?: string }).name)
      console.error('[mailer] Resend msg:', error.message)
      throw new Error(error.message)
    }
  },
}
