import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'
import { todaysLessons, formatOzetBody, type Period, type Slot } from '@/src/domains/schedule/scheduleMath'

const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }

export const dersProgramiOzetiFn = inngest.createFunction(
  { id: 'ders-programi-ozeti', triggers: [{ cron: 'TZ=Europe/Istanbul 30 7 * * 1-5' }] },
  async ({ step }) => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
    const today = DAY_MAP[wd]
    if (!today) return { sent: 0 } // hafta sonu güvenlik freni

    const sent = await step.run('ders-ozetleri', async () => {
      const db = createServiceClient()
      const { data: rows } = await db
        .from('lesson_schedules')
        .select('teacher_id, school_id, slots, periods')
        .not('teacher_id', 'is', null)
      if (!rows?.length) return 0

      const { data: classes } = await db.from('classes').select('id, name').is('deleted_at', null)
      const nameById = new Map((classes ?? []).map(c => [c.id as string, c.name as string]))

      const notifs: { user_id: string; school_id: string; title: string; body: string }[] = []
      const pushes: Promise<unknown>[] = []

      for (const r of rows) {
        const lessons = todaysLessons((r.slots ?? []) as unknown as Slot[], (r.periods ?? []) as unknown as Period[], today)
        if (!lessons.length) continue
        const body = formatOzetBody(lessons.map(l => ({ period: l.period, className: nameById.get(l.classId) ?? '?' })))
        notifs.push({ user_id: r.teacher_id as string, school_id: r.school_id as string, title: 'Bugünün dersleri', body })
        pushes.push(sendPushToUser(r.teacher_id as string, { title: 'Bugünün dersleri', body, url: '/ders-programi' }))
      }

      if (notifs.length) await db.from('notifications').insert(notifs)
      const results = await Promise.allSettled(pushes)
      const failed = results.filter(x => x.status === 'rejected').length
      if (failed) logger.error({ event: 'ders_programi_ozeti_push_failed', failed }, 'Ders programı özet push hatası')
      return notifs.length
    })

    return { sent }
  },
)
