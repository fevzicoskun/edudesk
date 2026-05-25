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
    const payload = {
      from:    opts.from ?? FROM,
      to:      [opts.to ?? process.env.FEEDBACK_TO ?? ''],
      subject: opts.subject,
      ...(opts.html ? { html: opts.html } : { text: opts.text ?? '' }),
    }

    const { error } = await resend.emails.send(payload)
    if (error) {
      console.error('[mailer] Resend error:', JSON.stringify(error))
      throw new Error(error.message)
    }
  },
}
