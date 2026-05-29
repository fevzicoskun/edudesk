import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'
import { unsubscribeUrl } from '@/src/lib/unsubscribeToken'

export const homeworkReminderFn = inngest.createFunction(
  {
    id: 'homework-reminder',
    triggers: [{ cron: '0 5 * * *' }], // 08:00 Türkiye saati (UTC+3)
  },
  async ({ step }) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'

    // 1. Önümüzdeki 1-7 gün içinde teslimi olan ödevleri çek
    const candidates = await step.run('fetch-due-homeworks', async () => {
      const supabase = createServiceClient()

      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const maxDate = new Date(today)
      maxDate.setDate(maxDate.getDate() + 7)

      const { data: homeworks } = await supabase
        .from('homeworks')
        .select('id, title, due_date, school_id, teacher_id, class_id')
        .is('deleted_at', null)
        .not('due_date', 'is', null)
        .gte('due_date', today.toISOString().split('T')[0])
        .lte('due_date', maxDate.toISOString().split('T')[0])

      if (!homeworks?.length) return []

      const teacherIds = [...new Set(homeworks.map((h) => h.teacher_id))]

      const [{ data: prefs }, { data: authUsers }] = await Promise.all([
        supabase
          .from('notification_preferences')
          .select('user_id, days_before, email_on')
          .in('user_id', teacherIds),
        supabase.auth.admin.listUsers({ perPage: 1000 }),
      ])

      const prefMap = new Map(prefs?.map((p) => [p.user_id, p]) ?? [])
      const emailMap = new Map(
        authUsers?.users?.map((u) => [u.id, u.email ?? '']) ?? []
      )

      return homeworks.flatMap((hw) => {
        const pref = prefMap.get(hw.teacher_id)
        if (!pref) return []

        const target = new Date(today)
        target.setDate(target.getDate() + pref.days_before)
        const targetStr = target.toISOString().split('T')[0]

        if (hw.due_date.slice(0, 10) !== targetStr) return []

        return [
          {
            homeworkId: hw.id,
            classId: hw.class_id,
            title: hw.title,
            dueDate: hw.due_date.slice(0, 10),
            schoolId: hw.school_id,
            teacherId: hw.teacher_id,
            teacherEmail: emailMap.get(hw.teacher_id) ?? '',
            emailOn: pref.email_on,
            daysBefore: pref.days_before,
          },
        ]
      })
    })

    if (!candidates.length) return { sent: 0 }

    // 2. Bugün zaten bildirim gönderilmiş olanları çıkar (dedup)
    const toSend = await step.run('dedup-check', async () => {
      const supabase = createServiceClient()
      const todayStr = new Date().toISOString().split('T')[0]

      const { data: existing } = await supabase
        .from('notifications')
        .select('homework_id, user_id')
        .in(
          'homework_id',
          candidates.map((c) => c.homeworkId)
        )
        .gte('created_at', todayStr)

      const sent = new Set(
        existing?.map((n) => `${n.homework_id}:${n.user_id}`) ?? []
      )

      return candidates.filter(
        (c) => !sent.has(`${c.homeworkId}:${c.teacherId}`)
      )
    })

    if (!toSend.length) return { sent: 0, skipped: candidates.length }

    // 3. In-app bildirim ekle
    await step.run('insert-notifications', async () => {
      const supabase = createServiceClient()
      await supabase.from('notifications').insert(
        toSend.map((c) => ({
          user_id: c.teacherId,
          school_id: c.schoolId,
          title: 'Ödev teslimi yaklaşıyor',
          body: `"${c.title}" ödevi ${c.daysBefore === 1 ? 'yarın' : `${c.daysBefore} gün içinde`} (${c.dueDate}) teslim alınacak.`,
          homework_id: c.homeworkId,
        }))
      )
    })

    // 4. Öğretmene e-posta gönder (email_on = true olanlar)
    const teacherEmailTargets = toSend.filter((c) => c.emailOn && c.teacherEmail)

    if (teacherEmailTargets.length) {
      await step.run('send-teacher-emails', async () => {
        const results = await Promise.allSettled(
          teacherEmailTargets.map((c) =>
            mailer.sendMail({

              to: c.teacherEmail,
              subject: `Ödev Hatırlatması: ${c.title}`,
              html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
                <p>Merhaba,</p>
                <p><strong>${c.title}</strong> adlı ödevinizin teslim tarihi <strong>${c.dueDate}</strong>.</p>
                <p>${c.daysBefore === 1 ? 'Yarın teslim alınacak.' : `${c.daysBefore} gün kaldı.`}</p>
                <p>EduDesk'e giriş yaparak öğrenci teslim durumlarını görüntüleyebilirsiniz.</p>
                <p style="color:#bbb;font-size:11px;margin-top:24px">Bu bildirimleri durdurmak veya sıklığını değiştirmek için <a href="${baseUrl}/ayarlar" style="color:#bbb">bildirim ayarlarınızı</a> güncelleyebilirsiniz.</p>
              </body></html>`,
            })
          )
        )
        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length) {
          console.error(`[homeworkReminder] ${failed.length}/${teacherEmailTargets.length} öğretmen e-postası gönderilemedi`, failed.map((r) => (r as PromiseRejectedResult).reason))
        }
      })
    }

    // 5. Velilere e-posta gönder (teslim etmemiş öğrencilerin velileri)
    const veliEmails = await step.run('fetch-veli-emails', async () => {
      const supabase = createServiceClient()
      const results: { to: string; ogrenciAdi: string; odevBaslik: string; dueDate: string; studentId: string }[] = []

      for (const hw of toSend) {
        const [{ data: students }, { data: subs }] = await Promise.all([
          supabase
            .from('students')
            .select('id, full_name, veli_email')
            .eq('class_id', hw.classId)
            .eq('school_id', hw.schoolId)
            .not('veli_email', 'is', null)
            .eq('veli_email_opt_out', false),
          supabase
            .from('homework_submissions')
            .select('student_id')
            .eq('homework_id', hw.homeworkId)
            .eq('status', 'yapildi'),
        ])

        if (!students?.length) continue

        const teslimEdenIds = new Set(subs?.map((s) => s.student_id) ?? [])

        for (const s of students) {
          if (!s.veli_email || teslimEdenIds.has(s.id)) continue
          results.push({
            to: s.veli_email,
            ogrenciAdi: s.full_name,
            odevBaslik: hw.title,
            dueDate: hw.dueDate,
            studentId: s.id,
          })
        }
      }

      return results
    })

    if (veliEmails.length) {
      await step.run('send-veli-emails', async () => {
        const results = await Promise.allSettled(
          veliEmails.map((v) =>
            mailer.sendMail({

              to: v.to,
              subject: `Ödev Hatırlatması — ${v.ogrenciAdi}`,
              html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
                <p>Sayın veli,</p>
                <p><strong>${v.ogrenciAdi}</strong> adlı öğrencinizin <strong>"${v.odevBaslik}"</strong> ödevi <strong>${v.dueDate}</strong> tarihinde teslim edilmesi gerekmektedir.</p>
                <p>Lütfen ödevin tamamlandığından emin olunuz.</p>
                <p style="color:#888;font-size:12px;margin-top:16px">EduDesk — Okul Takip Sistemi</p>
                <p style="color:#bbb;font-size:11px;margin-top:8px">Bu bildirimleri durdurmak için <a href="${unsubscribeUrl(v.studentId, baseUrl)}" style="color:#bbb">buraya tıklayın</a>.</p>
              </body></html>`,
            })
          )
        )
        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length) {
          console.error(`[homeworkReminder] ${failed.length}/${veliEmails.length} veli e-postası gönderilemedi`, failed.map((r) => (r as PromiseRejectedResult).reason))
        }
      })
    }

    return { sent: toSend.length, teacherEmailed: teacherEmailTargets.length, veliEmailed: veliEmails.length }
  }
)
