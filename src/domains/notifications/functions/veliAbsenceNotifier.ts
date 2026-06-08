import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'
import { esc, formatDateTR } from '@/src/lib/email-utils'

interface StudentRow {
  full_name:          string
  veli_email:         string | null
  veli_ad:            string | null
  veli_email_opt_out: boolean
}

export const veliAbsenceNotifierFn = inngest.createFunction(
  { id: 'veli-absence-notifier', triggers: [{ event: 'attendance/absent' }] },
  async ({ event, step }) => {
    const { studentId, classId, date, schoolId } = event.data as {
      studentId: string
      classId:   string
      date:      string
      schoolId:  string
    }

    await step.sleep('bekle-45dk', '45m')

    const record = await step.run('kontrol', async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('attendance')
        .select('status, notified_at, students(full_name, veli_email, veli_ad, veli_email_opt_out)')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('date', date)
        .maybeSingle()
      if (error) throw new Error(error.message) // Inngest retry tetiklensin
      return data
    })

    if (!record)                           return { skipped: 'kayit-yok' }
    if (record.status === 'present')       return { skipped: 'geldi' }
    if (record.notified_at)               return { skipped: 'zaten-bildirildi' }

    const student = record.students
    if (!student?.veli_email || student.veli_email_opt_out) return { skipped: 'email-yok' }

    const tarih = formatDateTR(date)

    const durum = record.status === 'absent'
      ? 'devamsız kaydedilmiştir'
      : 'geç olarak okula gelmiştir'

    await step.run('email-gonder', async () => {
      await mailer.sendMail({
        to:      student.veli_email!,
        subject: `Devamsızlık Bildirimi — ${student.full_name}`,
        text:    `Sayın ${student.veli_ad ?? 'Veli'},\n\n${student.full_name} adlı öğrenci ${tarih} tarihinde ${durum}.\n\nEduDesk`,
        html:    `<p>Sayın <strong>${esc(student.veli_ad ?? 'Veli')}</strong>,</p><p><strong>${esc(student.full_name)}</strong> adlı öğrenci <strong>${esc(tarih)}</strong> tarihinde <strong>${esc(durum)}</strong>.</p><p style="color:#6b7280;font-size:12px">EduDesk okul yönetim sistemi</p>`,
      })
    })

    await step.run('isaretele', async () => {
      const supabase = createServiceClient()
      await supabase
        .from('attendance')
        .update({ notified_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('school_id', schoolId)
        .eq('date', date)
    })

    return { sent: 1, status: record.status }
  }
)
