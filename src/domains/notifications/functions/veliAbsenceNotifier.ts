import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'

export const veliAbsenceNotifierFn = inngest.createFunction(
  { id: 'veli-absence-notifier', triggers: [{ event: 'attendance/saved' }] },
  async ({ event, step }) => {
    const { absentStudentIds, date, schoolId } = event.data as {
      absentStudentIds: string[]
      date:             string
      schoolId:         string
    }

    if (!absentStudentIds.length) return { sent: 0 }

    const students = await step.run('fetch-students', async () => {
      const supabase = createServiceClient()
      const { data } = await supabase
        .from('students')
        .select('id, full_name, veli_email, veli_ad, veli_email_opt_out')
        .in('id', absentStudentIds)
        .eq('school_id', schoolId)
        .eq('veli_email_opt_out', false)
        .not('veli_email', 'is', null)
      return data ?? []
    })

    if (!students.length) return { sent: 0 }

    const [dd, mm, yyyy] = [
      date.slice(8, 10),
      date.slice(5, 7),
      date.slice(0, 4),
    ]
    const tarih = `${dd}.${mm}.${yyyy}`

    const results = await step.run('send-emails', async () =>
      Promise.allSettled(
        students.map(s =>
          mailer.sendMail({
            from:    `"EduDesk" <${process.env.SMTP_USER}>`,
            to:      s.veli_email!,
            subject: `Devamsızlık Bildirimi — ${s.full_name}`,
            text:    `Sayın ${s.veli_ad ?? 'Veli'},\n\n${s.full_name} adlı öğrenci ${tarih} tarihinde devamsız kaydedilmiştir.\n\nEduDesk`,
            html:    `<p>Sayın <strong>${s.veli_ad ?? 'Veli'}</strong>,</p><p><strong>${s.full_name}</strong> adlı öğrenci <strong>${tarih}</strong> tarihinde devamsız kaydedilmiştir.</p><p style="color:#6b7280;font-size:12px">EduDesk okul yönetim sistemi</p>`,
          })
        )
      )
    )

    const failed = results.filter(r => r.status === 'rejected').length
    if (failed) console.error(`[veliAbsenceNotifier] ${failed} email gönderilemedi`)

    return { sent: results.length - failed, failed }
  }
)
