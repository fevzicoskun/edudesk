import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'
import { esc, formatDateTR } from '@/src/lib/email-utils'
import { logger } from '@/src/infrastructure/observability/logger'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'

interface StudentRow {
  id:                 string
  full_name:          string
  veli_email:         string | null
  veli_ad:            string | null
  veli_email_opt_out?: boolean
}

export function filterEligibleVeliler(students: StudentRow[]): StudentRow[] {
  return students.filter(s => s.veli_email && !s.veli_email_opt_out).slice(0, 50)
}

export const homeworkCreatedNotifierFn = inngest.createFunction(
  { id: 'homework-created-notifier', triggers: [{ event: 'homework/created' }] },
  async ({ event, step }) => {
    const { homeworkId, classId, schoolId } = event.data as {
      homeworkId: string
      classId:   string
      schoolId:  string
    }

    const hw = await step.run('fetch-homework', async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('homeworks')
        .select('id, title, due_date, is_template, teacher_id')
        .eq('id', homeworkId)
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .maybeSingle()
      // Bulunamadı (silinmiş) = atla; gerçek okuma hatası = yeniden dene, yoksa veliler habersiz kalır
      if (error) throw new Error(`Ödev okunamadı: ${error.message}`)
      return data
    })

    if (!hw || hw.is_template) return { skipped: 'şablon veya bulunamadı' }

    const targets = await step.run('fetch-veliler', async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, veli_email, veli_ad')
        .eq('class_id', classId)
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .not('veli_email', 'is', null)
        .eq('veli_email_opt_out', false)
      if (error) throw new Error(`Veliler okunamadı: ${error.message}`)
      return filterEligibleVeliler((data ?? []) as StudentRow[])
    })

    if (!targets.length) return { sent: 0, reason: 'veli-email-yok' }
    if (targets.length > 50) {
      logger.warn({ event: 'veli_limit_exceeded', homework_id: homeworkId, total: targets.length, sent: 50 }, 'Veli sayısı limiti aşıldı, ilk 50 bildirildi')
    }

    const dueDateStr = hw.due_date ? formatDateTR(hw.due_date) : ''

    const gonderilen = await step.run('send-emails', async () => {
      const results = await Promise.allSettled(
        targets.slice(0, 50).map((s: StudentRow) =>
          mailer.sendMail({
            to:      s.veli_email!,
            subject: `Yeni Ödev: ${hw.title}`,
            html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;color:#1f2937;line-height:1.6}
.box{max-width:520px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px}
.badge{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af}
</style></head>
<body><div class="box">
<p>${esc(s.veli_ad ?? 'Sayın Veli')},</p>
<p><strong>${esc(s.full_name)}</strong> için yeni bir ödev tanımlandı:</p>
<p class="badge">"${esc(hw.title)}"</p>
${dueDateStr ? `<p>Son teslim tarihi: <strong>${esc(dueDateStr)}</strong></p>` : ''}
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`,
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed) logger.error({ event: 'veli_mail_failed', homework_id: homeworkId, failed, total: targets.length }, 'Veli bildirimi e-postaları gönderilemedi')
      return results.length - failed
    })

    // Öğretmene push: veliler bildirildi
    // Sayı gerçekten giden e-postadan — gönderim çökse de "30 veliye gönderildi" demesin
    if (hw.teacher_id && gonderilen > 0) {
      await step.run('send-push', async () => {
        await sendPushToUser(hw.teacher_id, {
          title: 'Veliler bildirildi',
          body: `"${hw.title}" ödevi için ${gonderilen} veliye e-posta gönderildi.`,
          url: '/odevler',
        })
      })
    }

    return { sent: gonderilen }
  }
)
