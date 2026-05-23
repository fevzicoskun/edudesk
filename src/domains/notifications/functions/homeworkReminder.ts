import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'

export const homeworkReminderFn = inngest.createFunction(
  {
    id: 'homework-reminder',
    triggers: [{ cron: '0 5 * * *' }], // 08:00 Türkiye saati (UTC+3)
  },
  async ({ step }) => {
    // 1. Önümüzdeki 1-7 gün içinde teslimi olan ödevleri çek
    const candidates = await step.run('fetch-due-homeworks', async () => {
      const supabase = createServiceClient()

      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const maxDate = new Date(today)
      maxDate.setDate(maxDate.getDate() + 7)

      const { data: homeworks } = await supabase
        .from('homeworks')
        .select('id, title, due_date, school_id, teacher_id')
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

      const todayStr = today.toISOString().split('T')[0]

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

    // 4. E-posta gönder (email_on = true olanlar)
    const emailTargets = toSend.filter((c) => c.emailOn && c.teacherEmail)

    if (emailTargets.length) {
      await step.run('send-emails', async () => {
        await Promise.allSettled(
          emailTargets.map((c) =>
            mailer.sendMail({
              from: `EduDesk <${process.env.SMTP_USER}>`,
              to: c.teacherEmail,
              subject: `Ödev Hatırlatması: ${c.title}`,
              html: `
                <p>Merhaba,</p>
                <p><strong>${c.title}</strong> adlı ödevinizin teslim tarihi <strong>${c.dueDate}</strong>.</p>
                <p>${c.daysBefore === 1 ? 'Yarın teslim alınacak.' : `${c.daysBefore} gün kaldı.`}</p>
                <p>EduDesk'e giriş yaparak öğrenci teslim durumlarını görüntüleyebilirsiniz.</p>
              `,
            })
          )
        )
      })
    }

    return { sent: toSend.length, emailed: emailTargets.length }
  }
)
