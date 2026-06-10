import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'
import { formatDateTR, buildMissedEmail } from '@/src/lib/email-utils'
import { logger } from '@/src/infrastructure/observability/logger'

// "Dün" Türkiye saatine göre hesapla. Server UTC'de çalışsa da Intl ile doğru tarihi üretiriz.
function yesterdayInTurkey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)
}

export const odevSonrasiVeliNotifierFn = inngest.createFunction(
  {
    id: 'odev-sonrasi-veli-notifier',
    triggers: [{ cron: 'TZ=Europe/Istanbul 0 9 * * *' }],
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

    // 2. Teslim etmemiş öğrencilerin velilerini topla (2 toplu sorgu — N+1 yerine)
    const candidates = await step.run('teslim-etmeyenler', async () => {
      const supabase = createServiceClient()

      const uniqueClassIds  = [...new Set(homeworks.map(hw => hw.class_id))]
      const uniqueSchoolIds = [...new Set(homeworks.map(hw => hw.school_id))]
      const hwIds           = homeworks.map(hw => hw.id)

      const [{ data: allStudents }, { data: allSubs }] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, veli_email, veli_ad, veli_email_opt_out, class_id')
          .in('class_id', uniqueClassIds)
          .in('school_id', uniqueSchoolIds)
          .is('deleted_at', null)
          .not('veli_email', 'is', null)
          .eq('veli_email_opt_out', false),
        supabase
          .from('homework_submissions')
          .select('student_id, homework_id, status')
          .in('homework_id', hwIds)
          .in('school_id', uniqueSchoolIds),
      ])

      const studentsByClass = new Map<string, { id: string; full_name: string; veli_email: string; veli_ad: string | null; class_id: string }[]>()
      for (const s of allStudents ?? []) {
        if (!s.veli_email) continue
        const list = studentsByClass.get(s.class_id) ?? []
        list.push(s as { id: string; full_name: string; veli_email: string; veli_ad: string | null; class_id: string })
        studentsByClass.set(s.class_id, list)
      }

      const subKey = new Map<string, string>()
      for (const s of allSubs ?? []) subKey.set(`${s.homework_id}:${s.student_id}`, s.status)

      const results: { homeworkId: string; studentId: string; schoolId: string; to: string; veliAd: string; ogrenciAdi: string; odevBaslik: string; dueDate: string }[] = []
      for (const hw of homeworks) {
        for (const student of (studentsByClass.get(hw.class_id) ?? [])) {
          const status = subKey.get(`${hw.id}:${student.id}`) ?? 'yapilmadi'
          if (status === 'yapildi' || status === 'mazeretli') continue
          results.push({
            homeworkId: hw.id,
            studentId:  student.id,
            schoolId:   hw.school_id,
            to:         student.veli_email,
            veliAd:     student.veli_ad ?? 'Sayın Veli',
            ogrenciAdi: student.full_name,
            odevBaslik: hw.title,
            dueDate:    hw.due_date ?? '',
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
        logger.error({ event: 'veli_sonrasi_mail_failed', failed: failed.length, total: toSend.length }, 'Ödev sonrası veli e-postaları gönderilemedi')
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
