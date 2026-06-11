/**
 * Production kritik hata e-posta bildirimi.
 *
 * - Sadece NODE_ENV === 'production' ortamında e-posta gönderir;
 *   diğer ortamlarda logger.error ile yetinir.
 * - Rate limit: aynı hata parmak izi için saatte en fazla 1,
 *   global toplam saatte en fazla 5 e-posta (bkz. alert-rate-limiter.ts).
 * - Gönderim fire-and-forget: kendi hatası asla yukarı fırlamaz.
 * - Alıcı: ALERT_EMAIL → yoksa FEEDBACK_TO → ikisi de yoksa logger.warn.
 */
import { mailer } from '@/src/lib/mailer'
import { env } from '@/src/lib/env'
import { esc } from '@/src/lib/email-utils'
import { logger } from '@/src/infrastructure/observability/logger'
import { AlertRateLimiter, errorFingerprint } from './alert-rate-limiter'

export interface CriticalAlertInput {
  name:     string
  message:  string
  digest?:  string
  context?: Record<string, unknown>
}

// Modül seviyesinde tek instance — aynı server process içinde paylaşılır.
const limiter = new AlertRateLimiter()

export function sendCriticalAlert(err: CriticalAlertInput): void {
  // Her durumda logla
  logger.error(
    { event: 'critical_error', name: err.name, message: err.message, digest: err.digest, context: err.context },
    `Kritik hata: ${err.name}`
  )

  // Sadece production'da e-posta gönder
  if (process.env.NODE_ENV !== 'production') return

  const to = env.ALERT_EMAIL || env.FEEDBACK_TO
  if (!to) {
    logger.warn(
      { event: 'critical_alert_no_recipient' },
      'Kritik hata e-postası gönderilemedi: ALERT_EMAIL ve FEEDBACK_TO tanımsız'
    )
    return
  }

  const fingerprint = errorFingerprint(err.name, err.message)
  if (!limiter.tryAcquire(fingerprint)) {
    logger.warn(
      { event: 'critical_alert_rate_limited', fingerprint, name: err.name },
      'Kritik hata e-postası rate limit nedeniyle atlandı'
    )
    return
  }

  const subject = `[EduDesk ALERT] ${err.name}: ${err.message.slice(0, 80)}`

  // Fire-and-forget — gönderim hatası asla yukarı fırlamaz
  mailer
    .sendMail({ to, subject, html: buildAlertHtml(err, fingerprint) })
    .catch(sendErr => {
      logger.error(
        { event: 'critical_alert_send_failed', err: String(sendErr) },
        'Kritik hata e-postası gönderilemedi'
      )
    })
}

function buildAlertHtml(err: CriticalAlertInput, fingerprint: string): string {
  const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })

  const contextRows = Object.entries(err.context ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${esc(k)}</td><td style="padding:4px 0">${esc(String(v))}</td></tr>`)
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1f2937;line-height:1.6">
<div style="max-width:560px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
<p style="display:inline-block;background:#fef2f2;color:#b91c1c;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600">KRİTİK HATA</p>
<h2 style="margin:12px 0 4px;font-size:18px">${esc(err.name)}</h2>
<p style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:12px;font-family:monospace;font-size:13px;white-space:pre-wrap">${esc(err.message)}</p>
<table style="font-size:13px;border-collapse:collapse">
<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Tarih</td><td style="padding:4px 0">${esc(now)}</td></tr>
${err.digest ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Digest</td><td style="padding:4px 0">${esc(err.digest)}</td></tr>` : ''}
<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Parmak izi</td><td style="padding:4px 0">${esc(fingerprint)}</td></tr>
${contextRows}
</table>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af">EduDesk — Otomatik kritik hata bildirimi (aynı hata için saatte en fazla 1 e-posta)</div>
</div></body></html>`
}
