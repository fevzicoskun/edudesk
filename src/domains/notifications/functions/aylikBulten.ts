import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'
import { turkeyDate } from '@/src/lib/email-utils'

export const aylikBultenFn = inngest.createFunction(
  { id: 'aylik-bulten', triggers: [{ cron: '0 5 1 * *' }] }, // Her ayın 1'i 08:00 Türkiye
  async ({ step }) => {
    // Geçen ayın aralığı — Türkiye saatine göre hesapla
    const todayStr = turkeyDate()
    const [curYear, curMonth] = todayStr.split('-').map(Number)
    const lastMo  = curMonth === 1 ? 12 : curMonth - 1
    const lastYr  = curMonth === 1 ? curYear - 1 : curYear
    const pad     = (n: number) => String(n).padStart(2, '0')
    const monthStart = `${lastYr}-${pad(lastMo)}-01`
    const daysInLastMonth = new Date(lastYr, lastMo, 0).getDate()
    const monthEnd = `${lastYr}-${pad(lastMo)}-${pad(daysInLastMonth)}`
    const monthLabel = new Intl.DateTimeFormat('tr-TR', {
      month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
    }).format(new Date(`${monthStart}T12:00:00`))

    // 1. Tüm okulları ve müdürleri çek
    const schools = await step.run('fetch-schools', async () => {
      const db = createServiceClient()
      const { data } = await db
        .from('profiles')
        .select('id, full_name, school_id')
        .eq('role', 'mudur')
      return data ?? []
    })

    if (!schools.length) return { sent: 0 }

    // Kararlı sıra: step ID'leri retry'larda aynı okula denk gelsin
    const sortedSchools = [...schools].sort((a, b) => (a.school_id ?? '').localeCompare(b.school_id ?? ''))

    // 2. Müdür emaillerini al (pagination ile — 1000+ kullanıcı desteği)
    const emailEntries = await step.run('fetch-emails', async (): Promise<[string, string][]> => {
      const db = createServiceClient()
      const allUsers: { id: string; email?: string }[] = []
      let page = 1
      for (;;) {
        const { data } = await db.auth.admin.listUsers({ perPage: 1000, page })
        const batch = data?.users ?? []
        allUsers.push(...batch)
        if (batch.length < 1000) break
        page++
      }
      return allUsers.map(u => [u.id, u.email ?? ''] as [string, string])
    })
    const emailMap = new Map<string, string>(emailEntries)

    let totalSent = 0

    // 3. Her okul için bülten gönder
    for (const mudur of sortedSchools) {
      const mudurEmail = emailMap.get(mudur.id)
      if (!mudurEmail || !mudur.school_id) continue

      const stats = await step.run(`stats-${mudur.school_id}`, async () => {
        const db = createServiceClient()
        const sid = mudur.school_id!

        const [
          { count: studentCount },
          { count: teacherCount },
          { data: classes },
          { data: attendance },
          { data: submissions },
          { data: meetings },
        ] = await Promise.all([
          db.from('students').select('id', { count: 'exact', head: true }).eq('school_id', sid).is('deleted_at', null),
          db.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', sid).in('role', ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi']),
          db.from('classes').select('id, name').eq('school_id', sid).is('deleted_at', null),
          db.from('attendance').select('class_id, status').eq('school_id', sid).gte('date', monthStart).lte('date', monthEnd),
          db.from('homework_submissions').select('status').eq('school_id', sid).gte('updated_at', monthStart).lte('updated_at', monthEnd + 'T23:59:59'),
          db.from('school_meetings').select('id').eq('school_id', sid).gte('meeting_date', monthStart).lte('meeting_date', monthEnd),
        ])

        // Tamamlanan ödev sayısı
        const completedHomeworks = (submissions ?? []).filter(s => s.status === 'yapildi').length

        // En iyi yoklama sınıfı
        const classPresentMap = new Map<string, { present: number; total: number }>()
        for (const rec of attendance ?? []) {
          if (!classPresentMap.has(rec.class_id)) classPresentMap.set(rec.class_id, { present: 0, total: 0 })
          const entry = classPresentMap.get(rec.class_id)!
          entry.total++
          if (rec.status === 'present') entry.present++
        }

        const classNameMap = new Map((classes ?? []).map(c => [c.id, c.name]))
        let bestClass = '—'
        let bestRate  = -1
        for (const [classId, { present, total }] of classPresentMap) {
          const rate = total > 0 ? present / total : 0
          if (rate > bestRate) { bestRate = rate; bestClass = classNameMap.get(classId) ?? '—' }
        }

        return {
          studentCount:       studentCount ?? 0,
          teacherCount:       teacherCount ?? 0,
          completedHomeworks,
          bestClass,
          bestRate:           bestRate >= 0 ? Math.round(bestRate * 100) : null,
          meetingCount:       meetings?.length ?? 0,
        }
      })

      await step.run(`send-${mudur.school_id}`, async () => {
        const { studentCount, teacherCount, completedHomeworks, bestClass, bestRate, meetingCount } = stats

        await mailer.sendMail({
          to:      mudurEmail,
          subject: `📊 ${monthLabel} Okul Bülteni`,
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f8f9fa;margin:0;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:40px 32px;border:1px solid #e5e7eb">

    <div style="margin-bottom:8px">
      <span style="font-size:18px;font-weight:700;color:#1e293b">EduDesk</span>
    </div>
    <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 4px">${monthLabel} Bülteni</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 28px">Merhaba ${mudur.full_name ?? 'Müdür Bey/Hanım'}, geçen aya ait özet aşağıda.</p>

    <!-- İstatistik kartları -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
      <div style="background:#f0f9ff;border-radius:10px;padding:16px">
        <p style="font-size:28px;font-weight:700;color:#0369a1;margin:0">${completedHomeworks}</p>
        <p style="font-size:12px;color:#0284c7;margin:4px 0 0">tamamlanan ödev</p>
      </div>
      <div style="background:#f0fdf4;border-radius:10px;padding:16px">
        <p style="font-size:28px;font-weight:700;color:#15803d;margin:0">${meetingCount}</p>
        <p style="font-size:12px;color:#16a34a;margin:4px 0 0">okul toplantısı</p>
      </div>
      <div style="background:#faf5ff;border-radius:10px;padding:16px">
        <p style="font-size:28px;font-weight:700;color:#7e22ce;margin:0">${studentCount}</p>
        <p style="font-size:12px;color:#9333ea;margin:4px 0 0">aktif öğrenci</p>
      </div>
      <div style="background:#fff7ed;border-radius:10px;padding:16px">
        <p style="font-size:28px;font-weight:700;color:#c2410c;margin:0">${teacherCount}</p>
        <p style="font-size:12px;color:#ea580c;margin:4px 0 0">öğretmen</p>
      </div>
    </div>

    ${bestRate !== null ? `
    <!-- En iyi yoklama sınıfı -->
    <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:24px;border-left:4px solid #4f46e5">
      <p style="font-size:12px;font-weight:600;color:#4f46e5;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em">🏆 En İyi Yoklama</p>
      <p style="font-size:18px;font-weight:700;color:#1e293b;margin:0">${bestClass}</p>
      <p style="font-size:13px;color:#64748b;margin:4px 0 0">%${bestRate} devam oranı</p>
    </div>` : ''}

    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'}/yonetim"
       style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:24px">
      Komuta Merkezine Git →
    </a>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 16px">
    <p style="font-size:12px;color:#d1d5db;margin:0">EduDesk — Okul Takip Sistemi · Bu mail otomatik gönderilmiştir.</p>
  </div>
</body></html>`,
        })
      })

      totalSent++
    }

    return { sent: totalSent }
  }
)
