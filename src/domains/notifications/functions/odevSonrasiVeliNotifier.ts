import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'
import { formatDateTR, buildMissedEmail } from '@/src/lib/email-utils'

// "Dün" Türkiye saatine göre hesapla. Server UTC'de çalışsa da Intl ile doğru tarihi üretiriz.
function yesterdayInTurkey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)
}

export const odevSonrasiVeliNotifierFn = inngest.createFunction(
  {
    id: 'odev-sonrasi-veli-notifier',
    triggers: [{ cron: '0 6 * * *' }], // 09:00 Türkiye saati (UTC+3)
  },
  async ({ step }) => {
    // 1. Dün teslim tarihi geçmiş ödevleri bul (Türkiye tarihine göre)
    const homeworks = await step.run('gecmis-odevler', async () => {
      const supabase = createServiceClient()
      const { data } = await supabase
        .from('homeworks')
        .select('id, title, due_date, school_id, class_id')
        .is('deleted_at', null)
        .eq('is_template', false)
        .eq('due_date', yesterdayInTurkey())

      return data ?? []
    })

    if (!homeworks.length) return { sent: 0, reason: 'ödev-yok' }

    // 2. Her ödev için: teslim etmemiş öğrencilerin velilerini topla
    const candidates = await step.run('teslim-etmeyenler', async () => {
      const supabase = createServiceClient()
      const results: {
        homeworkId: string
        studentId: string
        schoolId: string
        to: string
        veliAd: string
        ogrenciAdi: string
        odevBaslik: string
        dueDate: string
      }[] = []

      for (const hw of homeworks) {
        const [{ data: students }, { data: subs }] = await Promise.all([
          supabase
            .from('students')
            .select('id, full_name, veli_email, veli_ad, veli_email_opt_out')
            .eq('class_id', hw.class_id)
            .eq('school_id', hw.school_id)
            .is('deleted_at', null)
            .not('veli_email', 'is', null)
            .eq('veli_email_opt_out', false),
          supabase
            .from('homework_submissions')
            .select('student_id, status')
            .eq('homework_id', hw.id)
            .eq('school_id', hw.school_id),
        ])

        if (!students?.length) continue

        const subMap = new Map(subs?.map(s => [s.student_id, s.status]) ?? [])

        for (const student of students) {
          if (!student.veli_email) continue
          const status = subMap.get(student.id) ?? 'yapilmadi'
          if (status === 'yapildi' || status === 'mazeretli') continue

          results.push({
            homeworkId: hw.id,
            studentId:  student.id,
            schoolId:   hw.school_id,
            to:         student.veli_email,
            veliAd:     student.veli_ad ?? 'Sayın Veli',
            ogrenciAdi: student.full_name,
            odevBaslik: hw.title,
            dueDate:    hw.due_date,
          })
        }
      }

      return results
    })

    if (!candidates.length) return { sent: 0, reason: 'teslim-edildi' }

    // 3. Dedup: daha önce bildirim gönderilenleri çıkar
    const toSend = await step.run('dedup', async () => {
      const supabase = createServiceClient()
      const { data: existing } = await supabase
        .from('homework_veli_notifications')
        .select('homework_id, student_id')
        .in('homework_id', candidates.map(c => c.homeworkId))

      const sentKeys = new Set(existing?.map(n => `${n.homework_id}:${n.student_id}`) ?? [])
      return candidates.filter(c => !sentKeys.has(`${c.homeworkId}:${c.studentId}`))
    })

    if (!toSend.length) return { sent: 0, reason: 'zaten-bildirildi' }

    // 4. E-posta gönder
    await step.run('email-gonder', async () => {
      const results = await Promise.allSettled(
        toSend.map(v =>
          mailer.sendMail({
            to:      v.to,
            subject: `Ödev Teslim Edilmedi — ${v.ogrenciAdi}`,
            html:    buildMissedEmail({
              veliAd:     v.veliAd,
              ogrenciAdi: v.ogrenciAdi,
              odevBaslik: v.odevBaslik,
              dueDateStr: formatDateTR(v.dueDate),
            }),
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length) {
        console.error(`[odevSonrasiVeli] ${failed.length}/${toSend.length} e-posta gönderilemedi`)
      }
    })

    // 5. Gönderilenleri kaydet (dedup için)
    await step.run('kayit-ekle', async () => {
      const supabase = createServiceClient()
      await supabase.from('homework_veli_notifications').insert(
        toSend.map(v => ({
          homework_id: v.homeworkId,
          student_id:  v.studentId,
        }))
      )
    })

    return { sent: toSend.length, skipped: candidates.length - toSend.length }
  }
)
