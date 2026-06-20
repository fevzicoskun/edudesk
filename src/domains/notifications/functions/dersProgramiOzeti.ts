import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'
import { todaysLessons, formatOzetBody, type Period, type Slot } from '@/src/domains/schedule/scheduleMath'
import { formatDutyReminder, type DutyInput } from '@/src/domains/schedule/dutyMath'

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

      // Bugün nöbetçi olan öğretmenler (RLS bypass — tüm okullar). Bir öğretmenin birden fazla nöbeti olabilir.
      const { data: dutyRows } = await db
        .from('teacher_duties')
        .select('teacher_id, school_id, day_of_week, time_range, location, notes')
        .eq('day_of_week', today)
      const dutiesByTeacher = new Map<string, typeof dutyRows>()
      for (const d of dutyRows ?? []) {
        const tid = d.teacher_id as string
        const list = dutiesByTeacher.get(tid) ?? []
        list.push(d)
        dutiesByTeacher.set(tid, list)
      }
      const handledTeachers = new Set<string>()

      // Öğretmenin bugünkü tüm nöbet satırlarını tek metne çevir (her nöbet ayrı satır).
      const dutyLinesFor = (tid: string): string[] =>
        (dutiesByTeacher.get(tid) ?? [])
          .map(d => formatDutyReminder(d as unknown as DutyInput, today))
          .filter((x): x is string => x !== null)
          .map(line => `🔔 ${line}`)

      const notifs: { user_id: string; school_id: string; title: string; body: string }[] = []
      const pushes: Promise<unknown>[] = []

      for (const r of rows) {
        const teacherId = r.teacher_id as string
        const lessons = todaysLessons((r.slots ?? []) as unknown as Slot[], (r.periods ?? []) as unknown as Period[], today)
        const dutyLines = dutyLinesFor(teacherId)
        if (dutiesByTeacher.has(teacherId)) handledTeachers.add(teacherId)
        if (!lessons.length && !dutyLines.length) continue // ne ders ne nöbet → bildirim yok

        const dersBody = lessons.length
          ? formatOzetBody(lessons.map(l => ({ period: l.period, className: nameById.get(l.classId) ?? '?' })))
          : ''
        const body = [dersBody, ...dutyLines].filter(Boolean).join('\n')
        const title = lessons.length ? 'Bugünün dersleri' : 'Bugün nöbettesin'
        notifs.push({ user_id: teacherId, school_id: r.school_id as string, title, body })
        pushes.push(sendPushToUser(teacherId, { title, body, url: '/ders-programi' }))
      }

      // Ders programı satırı OLMAYAN ama bugün nöbetçi olan öğretmenler de bildirim alsın.
      for (const [teacherId, list] of dutiesByTeacher) {
        if (handledTeachers.has(teacherId)) continue
        const dutyLines = dutyLinesFor(teacherId)
        if (!dutyLines.length) continue
        const body = dutyLines.join('\n')
        const schoolId = (list?.[0]?.school_id ?? '') as string
        notifs.push({ user_id: teacherId, school_id: schoolId, title: 'Bugün nöbettesin', body })
        pushes.push(sendPushToUser(teacherId, { title: 'Bugün nöbettesin', body, url: '/ders-programi' }))
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
