import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'

export const iyiHaberNotifierFn = inngest.createFunction(
  { id: 'iyi-haber-notifier', triggers: [{ cron: '0 14 * * 5' }] }, // Her Cuma 17:00 Türkiye
  async ({ step }) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'

    // Haftanın başı (Pazartesi) ve sonu (Pazar)
    const now = new Date()
    const dayOfWeek = now.getUTCDay() // 5 = Cuma
    const monday = new Date(now)
    monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7))
    monday.setUTCHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)
    sunday.setUTCHours(23, 59, 59, 999)

    const weekStart = monday.toISOString().split('T')[0]
    const weekEnd   = sunday.toISOString().split('T')[0]

    // 1. Bu haftaki teslim tarihi olan ödevler
    const candidates = await step.run('fetch-week-homeworks', async () => {
      const db = createServiceClient()

      const { data: homeworks } = await db
        .from('homeworks')
        .select('id, class_id, school_id, title')
        .is('deleted_at', null)
        .not('due_date', 'is', null)
        .gte('due_date', weekStart)
        .lte('due_date', weekEnd)

      if (!homeworks?.length) return []

      // Sınıf başına ödev listesi
      const hwByClass = new Map<string, string[]>()
      for (const hw of homeworks) {
        if (!hwByClass.has(hw.class_id)) hwByClass.set(hw.class_id, [])
        hwByClass.get(hw.class_id)!.push(hw.id)
      }

      const classIds    = [...hwByClass.keys()]
      const homeworkIds = homeworks.map(h => h.id)
      const schoolId    = homeworks[0]?.school_id

      // Öğrenciler + veli emaili
      const [{ data: students }, { data: submissions }] = await Promise.all([
        db
          .from('students')
          .select('id, full_name, class_id, veli_email, veli_ad, veli_email_opt_out')
          .in('class_id', classIds)
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .not('veli_email', 'is', null)
          .eq('veli_email_opt_out', false),
        db
          .from('homework_submissions')
          .select('student_id, homework_id, status')
          .in('homework_id', homeworkIds),
      ])

      if (!students?.length) return []

      // Öğrenci başına teslim haritası
      const submissionMap = new Map<string, Map<string, string>>()
      for (const s of submissions ?? []) {
        if (!submissionMap.has(s.student_id)) submissionMap.set(s.student_id, new Map())
        submissionMap.get(s.student_id)!.set(s.homework_id, s.status)
      }

      const results: { studentId: string; fullName: string; veliEmail: string; veliAd: string | null }[] = []

      for (const student of students) {
        const classHwIds = hwByClass.get(student.class_id) ?? []
        if (classHwIds.length === 0) continue

        const studentSubs = submissionMap.get(student.id) ?? new Map()
        const allDone = classHwIds.every(hwId => studentSubs.get(hwId) === 'yapildi')
        if (!allDone) continue

        results.push({
          studentId: student.id,
          fullName:  student.full_name,
          veliEmail: student.veli_email!,
          veliAd:    student.veli_ad ?? null,
        })
      }

      return results
    })

    if (!candidates.length) return { sent: 0 }

    // 2. Bu hafta zaten bildirim gönderilenleri çıkar
    const toSend = await step.run('dedup', async () => {
      const db = createServiceClient()
      const { data: existing } = await db
        .from('notifications')
        .select('user_id')
        .eq('title', 'iyi_haber_veli')
        .gte('created_at', weekStart)

      const alreadySent = new Set(existing?.map(n => n.user_id) ?? [])
      return candidates.filter(c => !alreadySent.has(c.studentId))
    })

    if (!toSend.length) return { sent: 0, skipped: candidates.length }

    // 3. Mailleri gönder
    await step.run('send-emails', async () => {
      const results = await Promise.allSettled(
        toSend.map(c =>
          mailer.sendMail({
            to:      c.veliEmail,
            subject: `🌟 ${c.fullName} bu hafta harika iş çıkardı!`,
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f8f9fa;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px 32px;border:1px solid #e5e7eb">
    <div style="margin-bottom:20px">
      <span style="font-size:18px;font-weight:700;color:#1e293b">EduDesk</span>
    </div>
    <div style="font-size:40px;margin-bottom:16px">🌟</div>
    <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 12px">Harika haber!</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">
      Sayın ${c.veliAd ?? 'Veli'},<br><br>
      <strong>${c.fullName}</strong> bu haftaki tüm ödevlerini zamanında ve eksiksiz teslim etti.
      Bu güzel çalışmayı kutlamak istedik! 👏
    </p>
    <a href="${baseUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
      Detayları Görüntüle
    </a>
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:28px 0">
    <p style="font-size:12px;color:#d1d5db;margin:0">EduDesk — Okul Takip Sistemi</p>
  </div>
</body></html>`,
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed) console.error(`[iyiHaber] ${failed}/${toSend.length} mail gönderilemedi`)
    })

    // 4. Gönderilenleri notifications tablosuna kaydet (dedup için)
    await step.run('record', async () => {
      const db = createServiceClient()
      await db.from('notifications').insert(
        toSend.map(c => ({
          user_id:  c.studentId,
          school_id: null,
          title:    'iyi_haber_veli',
          body:     `${c.fullName} bu haftaki tüm ödevlerini tamamladı.`,
        }))
      )
    })

    return { sent: toSend.length }
  }
)
