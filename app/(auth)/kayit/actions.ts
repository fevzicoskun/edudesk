'use server'

import { z } from 'zod'
import { mailer } from '@/src/lib/mailer'
import { logger } from '@/src/infrastructure/observability/logger'
import { esc } from '@/src/lib/email-utils'
import { env } from '@/src/lib/env'
import { createServiceClient } from '@/src/infrastructure/supabase/service'

const basvuruSchema = z.object({
  school_name:  z.string().trim().min(2, 'Okul adı zorunludur.').max(200),
  contact_name: z.string().trim().min(2, 'Yetkili adı zorunludur.').max(120),
  email:        z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi girin.').max(254),
  phone:        z.string().trim().max(30).optional().transform(v => v || null),
  note:         z.string().trim().max(2000).optional().transform(v => v || null),
})

/** Okul başvurusu: ÖNCE veritabanına (okul_basvurulari, /platform'da listelenir), sonra bildirim maili.
 *  2026-10-10: yalnız mail atılıyordu; info@ bounce verince başvurular sessizce kayboldu. */
export async function applySchool(_prev: unknown, formData: FormData) {
  const alan = (k: string) => (formData.get(k) as string | null) ?? undefined
  const parsed = basvuruSchema.safeParse({
    school_name:  alan('school_name') ?? '',
    contact_name: alan('contact_name') ?? '',
    email:        alan('email') ?? '',
    phone:        alan('phone'),
    note:         alan('note'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Okul adı, yetkili adı ve e-posta zorunludur.' }
  const b = parsed.data

  const { error } = await createServiceClient().from('okul_basvurulari').insert(b)
  if (error) {
    logger.error({ event: 'basvuru_kaydedilemedi', code: error.code }, 'Okul başvurusu kaydedilemedi')
    return { error: 'Başvuru kaydedilemedi, lütfen tekrar deneyin.' }
  }

  // Bildirim best-effort: başvuru kayıtlı, mail düşse de kaybolmaz. Otomatik test başvurusu mail atmaz.
  if (b.email.endsWith('@test.example')) return { success: true }
  try {
    await mailer.sendMail({
      to: env.FEEDBACK_TO,
      subject: `Yeni Okul Başvurusu: ${b.school_name}`,
      html: `
        <h2>Yeni EduDesk Okul Başvurusu</h2>
        <table cellpadding="8" style="border-collapse:collapse;font-size:14px">
          <tr><td><b>Okul Adı</b></td><td>${esc(b.school_name)}</td></tr>
          <tr><td><b>Yetkili</b></td><td>${esc(b.contact_name)}</td></tr>
          <tr><td><b>E-posta</b></td><td>${esc(b.email)}</td></tr>
          <tr><td><b>Telefon</b></td><td>${b.phone ? esc(b.phone) : '—'}</td></tr>
          <tr><td><b>Not</b></td><td>${b.note ? esc(b.note) : '—'}</td></tr>
        </table>
        <p>Tüm başvurular: /platform</p>
      `,
    })
  } catch (err) {
    logger.warn({ event: 'kayit_mail_failed', err: err instanceof Error ? err.message : String(err) }, 'Okul başvuru bildirimi gönderilemedi (başvuru kayıtlı)')
  }
  return { success: true }
}
