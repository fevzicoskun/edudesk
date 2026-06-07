import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'
import { esc, formatDateTR, turkeyDate } from '@/src/lib/email-utils'
import { unsubscribeUrl } from '@/src/lib/unsubscribeToken'
import { logger } from '@/src/infrastructure/observability/logger'

export const homeworkReminderFn = inngest.createFunction(
  {
    id: 'homework-reminder',
    triggers: [{ cron: '0 5 * * *' }], // 08:00 Türkiye saati (UTC+3)
  },
  async ({ step }) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'

    // 1. Önümüzdeki 1-7 gün içinde teslimi olan ödevleri çek (Türkiye tarihiyle)
    const candidates = await step.run('fetch-due-homeworks', async () => {
      const supabase = createServiceClient()

      const todayStr  = turkeyDate()
      const d7        = new Date(); d7.setDate(d7.getDate() + 7)
      const maxDateStr = turkeyDate(d7)

      const { data: homeworks } = await supabase
        .from('homeworks')
        .select('id, title, due_date, school_id, teacher_id, class_id')
        .is('deleted_at', null)
        .not('due_date', 'is', null)
        .gte('due_date', todayStr)
        .lte('due_date', maxDateStr)

      if (!homeworks?.length) return []

      const teacherIds = [...new Set(homeworks.map((h) => h.teacher_id))]

      // Pagination: 1000+ kullanıcı için tüm sayfaları çek
      const allAuthUsers: { id: string; email?: string }[] = []
      let page = 1
      for (;;) {
        const { data } = await supabase.auth.admin.listUsers({ perPage: 1000, page })
        const batch = data?.users ?? []
        allAuthUsers.push(...batch)
        if (batch.length < 1000) break
        page++
      }

      const [{ data: prefs }] = await Promise.all([
        supabase
          .from('notification_preferences')
          .select('user_id, days_before, email_on')
          .in('user_id', teacherIds),
      ])

      const prefMap = new Map(prefs?.map((p) => [p.user_id, p]) ?? [])
      const emailMap = new Map(allAuthUsers.map((u) => [u.id, u.email ?? '']))

      return homeworks.flatMap((hw) => {
        const pref = prefMap.get(hw.teacher_id)
        if (!pref) return []

        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() + pref.days_before)
        const targetStr = turkeyDate(targetDate)

        if (hw.due_date.slice(0, 10) !== targetStr) return []

        return [
          {
            homeworkId:   hw.id,
            classId:      hw.class_id,
            title:        hw.title,
            dueDate:      hw.due_date.slice(0, 10),
            schoolId:     hw.school_id,
            teacherId:    hw.teacher_id,
            teacherEmail: emailMap.get(hw.teacher_id) ?? '',
            emailOn:      pref.email_on,
            daysBefore:   pref.days_before,
          },
        ]
      })
    })

    if (!candidates.length) return { sent: 0 }

    // 2. Bugün zaten bildirim gönderilmiş olanları çıkar (dedup)
    const toSend = await step.run('dedup-check', async () => {
      const supabase = createServiceClient()

      const { data: existing } = await supabase
        .from('notifications')
        .select('homework_id, user_id')
        .in('homework_id', candidates.map((c) => c.homeworkId))
        .gte('created_at', turkeyDate())

      const sent = new Set(existing?.map((n) => `${n.homework_id}:${n.user_id}`) ?? [])
      return candidates.filter((c) => !sent.has(`${c.homeworkId}:${c.teacherId}`))
    })

    if (!toSend.length) return { sent: 0, skipped: candidates.length }

    // 3. In-app bildirim ekle
    await step.run('insert-notifications', async () => {
      const supabase = createServiceClient()
      await supabase.from('notifications').insert(
        toSend.map((c) => ({
          user_id:    c.teacherId,
          school_id:  c.schoolId,
          title:      'Ödev teslimi yaklaşıyor',
          body:       `"${c.title}" ödevi ${c.daysBefore === 1 ? 'yarın' : `${c.daysBefore} gün içinde`} (${formatDateTR(c.dueDate)}) teslim alınacak.`,
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
              to:      c.teacherEmail,
              subject: `Ödev Hatırlatması: ${c.title}`,
              html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
                <p>Merhaba,</p>
                <p><strong>${esc(c.title)}</strong> adlı ödevinizin teslim tarihi <strong>${esc(formatDateTR(c.dueDate))}</strong>.</p>
                <p>${c.daysBefore === 1 ? 'Yarın teslim alınacak.' : `${c.daysBefore} gün kaldı.`}</p>
                <p>EduDesk'e giriş yaparak öğrenci teslim durumlarını görüntüleyebilirsiniz.</p>
                <p style="color:#bbb;font-size:11px;margin-top:24px">Bu bildirimleri durdurmak veya sıklığını değiştirmek için <a href="${esc(baseUrl)}/ayarlar" style="color:#bbb">bildirim ayarlarınızı</a> güncelleyebilirsiniz.</p>
              </body></html>`,
            })
          )
        )
        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length) {
          logger.error({ event: 'teacher_reminder_mail_failed', failed: failed.length, total: teacherEmailTargets.length }, 'Öğretmen hatırlatma e-postaları gönderilemedi')
        }
      })
    }

    // 5. Velilere e-posta gönder (teslim etmemiş öğrencilerin velileri) — 2 toplu sorgu
    const veliEmails = await step.run('fetch-veli-emails', async () => {
      const supabase = createServiceClient()
      if (!toSend.length) return []

      const uniqueClassIds = [...new Set(toSend.map((hw) => hw.classId))]
      const hwIds          = toSend.map((hw) => hw.homeworkId)

      const [{ data: allStudents }, { data: doneSubs }] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, veli_email, class_id')
          .in('class_id', uniqueClassIds)
          .not('veli_email', 'is', null)
          .eq('veli_email_opt_out', false)
          .is('deleted_at', null),
        supabase
          .from('homework_submissions')
          .select('student_id, homework_id')
          .in('homework_id', hwIds)
          .eq('status', 'yapildi'),
      ])

      const doneKey = new Set((doneSubs ?? []).map((s) => `${s.homework_id}:${s.student_id}`))
      const studentsByClass = new Map<string, { id: string; full_name: string; veli_email: string }[]>()
      for (const s of allStudents ?? []) {
        if (!s.veli_email) continue
        const list = studentsByClass.get(s.class_id) ?? []
        list.push({ id: s.id, full_name: s.full_name, veli_email: s.veli_email })
        studentsByClass.set(s.class_id, list)
      }

      const results: { to: string; ogrenciAdi: string; odevBaslik: string; dueDate: string; studentId: string }[] = []
      for (const hw of toSend) {
        for (const s of (studentsByClass.get(hw.classId) ?? [])) {
          if (doneKey.has(`${hw.homeworkId}:${s.id}`)) continue
          results.push({
            to:         s.veli_email,
            ogrenciAdi: s.full_name,
            odevBaslik: hw.title,
            dueDate:    hw.dueDate,
            studentId:  s.id,
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
              to:      v.to,
              subject: `Ödev Hatırlatması — ${v.ogrenciAdi}`,
              html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
                <p>Sayın veli,</p>
                <p><strong>${esc(v.ogrenciAdi)}</strong> adlı öğrencinizin <strong>"${esc(v.odevBaslik)}"</strong> ödevi <strong>${esc(formatDateTR(v.dueDate))}</strong> tarihinde teslim edilmesi gerekmektedir.</p>
                <p>Lütfen ödevin tamamlandığından emin olunuz.</p>
                <p style="color:#888;font-size:12px;margin-top:16px">EduDesk — Okul Takip Sistemi</p>
                <p style="color:#bbb;font-size:11px;margin-top:8px">Bu bildirimleri durdurmak için <a href="${unsubscribeUrl(v.studentId, baseUrl)}" style="color:#bbb">buraya tıklayın</a>.</p>
              </body></html>`,
            })
          )
        )
        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length) {
          logger.error({ event: 'veli_reminder_mail_failed', failed: failed.length, total: veliEmails.length }, 'Veli hatırlatma e-postaları gönderilemedi')
        }
      })
    }

    return { sent: toSend.length, teacherEmailed: teacherEmailTargets.length, veliEmailed: veliEmails.length }
  }
)
