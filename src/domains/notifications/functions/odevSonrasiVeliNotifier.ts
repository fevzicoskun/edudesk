import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'

export const odevSonrasiVeliNotifierFn = inngest.createFunction(
  {
    id: 'odev-sonrasi-veli-notifier',
    triggers: [{ cron: '0 6 * * *' }], // 09:00 Türkiye saati (UTC+3)
  },
  async ({ step }) => {
    // 1. Dün teslim tarihi geçmiş ödevleri bul
    const homeworks = await step.run('gecmis-odevler', async () => {
      const supabase = createServiceClient()

      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const { data } = await supabase
        .from('homeworks')
        .select('id, title, due_date, school_id, class_id')
        .is('deleted_at', null)
        .eq('is_template', false)
        .eq('due_date', yesterdayStr)

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
            .eq('homework_id', hw.id),
        ])

        if (!students?.length) continue

        const subMap = new Map(subs?.map(s => [s.student_id, s.status]) ?? [])

        for (const student of students) {
          if (!student.veli_email) continue
          const status = subMap.get(student.id) ?? 'yapilmadi'
          if (status === 'yapildi' || status === 'mazeretli') continue

          results.push({
            homeworkId: hw.id,
            studentId: student.id,
            schoolId: hw.school_id,
            to: student.veli_email,
            veliAd: student.veli_ad ?? 'Sayın Veli',
            ogrenciAdi: student.full_name,
            odevBaslik: hw.title,
            dueDate: hw.due_date,
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
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    await step.run('email-gonder', async () => {
      const results = await Promise.allSettled(
        toSend.map(v =>
          mailer.sendMail({
            to: v.to,
            subject: `Ödev Teslim Edilmedi — ${v.ogrenciAdi}`,
            html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;color:#1f2937;line-height:1.6}
.box{max-width:520px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px}
.badge{display:inline-block;background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af}
</style></head>
<body><div class="box">
<p>${esc(v.veliAd)},</p>
<p><strong>${esc(v.ogrenciAdi)}</strong> adlı öğrencinizin</p>
<p class="badge">"${esc(v.odevBaslik)}"</p>
<p>adlı ödevi <strong>${esc(v.dueDate)}</strong> teslim tarihini geçmiş olup henüz teslim edilmemiştir.</p>
<p>Lütfen öğrencinizi bilgilendirmenizi rica ederiz.</p>
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`,
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
          student_id: v.studentId,
        }))
      )
    })

    return { sent: toSend.length, skipped: candidates.length - toSend.length }
  }
)
