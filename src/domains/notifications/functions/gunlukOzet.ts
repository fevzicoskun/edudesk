// Günlük Özet: hafta içi 07:30'da öğretmene tek sabah bildirimi
// (dersler + nöbet + dün eksik yoklama + bugün teslim ödev + bugünkü veli randevuları).
// dersProgramiOzeti'nin evrimi. Spec: docs/superpowers/specs/2026-07-04-gunluk-ozet-design.md
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'
import { todaysLessons, formatOzetBody, type Period, type Slot } from '@/src/domains/schedule/scheduleMath'
import { formatDutyReminder, type DutyInput } from '@/src/domains/schedule/dutyMath'
import { findMissingClasses } from './yoklamaHatirlatici'
import { formatGunlukOzet, previousSchoolDayGap, type GunlukOzetInput } from '../gunlukOzetMath'

const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }
const istDate = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)

export const gunlukOzetFn = inngest.createFunction(
  { id: 'gunluk-ozet', triggers: [{ cron: 'TZ=Europe/Istanbul 30 7 * * 1-5' }] },
  async ({ step }) => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
    const today = DAY_MAP[wd]
    if (!today) return { sent: 0 } // hafta sonu güvenlik freni

    const sent = await step.run('gunluk-ozetler', async () => {
      const db = createServiceClient()
      const todayISO = istDate(new Date())
      const dun = new Date()
      dun.setDate(dun.getDate() - previousSchoolDayGap(today))
      const dunISO = istDate(dun)

      // 6 toplu okul-geneli sorgu (RLS bypass). Fail-quiet: hatalı sorgunun bölümü boş kalır.
      const [schedules, classes, duties, attendance, homeworks, meetings] = await Promise.all([
        db.from('lesson_schedules').select('teacher_id, school_id, slots, periods').not('teacher_id', 'is', null),
        db.from('classes').select('id, name, school_id, mentor_teacher_id').is('deleted_at', null),
        db.from('teacher_duties').select('teacher_id, school_id, day_of_week, time_range, location, notes').eq('day_of_week', today),
        db.from('attendance').select('class_id, school_id').eq('date', dunISO),
        db.from('homeworks').select('teacher_id, school_id, title').eq('due_date', todayISO).is('deleted_at', null),
        db.from('parent_meetings').select('teacher_id, school_id, period, students(full_name)').eq('meet_date', todayISO).eq('status', 'planlandi'),
      ])
      for (const [name, r] of Object.entries({ schedules, classes, duties, attendance, homeworks, meetings })) {
        if (r.error) logger.error({ event: 'gunluk_ozet_query_failed', query: name, err: r.error.message }, 'Günlük özet sorgusu başarısız')
      }

      const nameById = new Map((classes.data ?? []).map(c => [c.id as string, c.name as string]))

      // Bölüm: dün eksik yoklama (mentor sınıfları). Tatil koruması: okulda dün 0 kayıt → okul atlanır.
      const schoolsWithAttendance = new Set((attendance.data ?? []).map(a => a.school_id as string))
      const mentorClasses = (classes.data ?? []).filter(
        c => c.mentor_teacher_id && schoolsWithAttendance.has(c.school_id as string),
      )
      const missingByMentor = new Map<string, { name: string; school_id: string }[]>()
      for (const c of findMissingClasses(mentorClasses as { id: string; name: string; school_id: string; mentor_teacher_id: string }[], (attendance.data ?? []) as { class_id: string }[])) {
        const list = missingByMentor.get(c.mentor_teacher_id) ?? []
        list.push({ name: c.name, school_id: c.school_id })
        missingByMentor.set(c.mentor_teacher_id, list)
      }

      // Bölüm: bugün teslim ödevler
      const hwByTeacher = new Map<string, { title: string; school_id: string }[]>()
      for (const h of homeworks.data ?? []) {
        const list = hwByTeacher.get(h.teacher_id as string) ?? []
        list.push({ title: h.title as string, school_id: h.school_id as string })
        hwByTeacher.set(h.teacher_id as string, list)
      }

      // Bölüm: bugünkü veli randevuları
      const meetingsByTeacher = new Map<string, { period: number; studentName: string; school_id: string }[]>()
      for (const m of meetings.data ?? []) {
        const student = m.students as unknown as { full_name: string } | null
        const list = meetingsByTeacher.get(m.teacher_id as string) ?? []
        list.push({ period: m.period as number, studentName: student?.full_name ?? '?', school_id: m.school_id as string })
        meetingsByTeacher.set(m.teacher_id as string, list)
      }

      // Bölüm: nöbetler
      const dutiesByTeacher = new Map<string, { school_id: string; lines: string[] }>()
      for (const d of duties.data ?? []) {
        const line = formatDutyReminder(d as unknown as DutyInput, today)
        if (!line) continue
        const cur = dutiesByTeacher.get(d.teacher_id as string) ?? { school_id: d.school_id as string, lines: [] }
        cur.lines.push(line)
        dutiesByTeacher.set(d.teacher_id as string, cur)
      }

      // Bölüm: bugünün dersleri
      const dersByTeacher = new Map<string, { school_id: string; satir: string }>()
      for (const r of schedules.data ?? []) {
        const lessons = todaysLessons((r.slots ?? []) as unknown as Slot[], (r.periods ?? []) as unknown as Period[], today)
        if (!lessons.length) continue
        const satir = formatOzetBody(lessons.map(l => ({ period: l.period, className: nameById.get(l.classId) ?? '?' })))
        dersByTeacher.set(r.teacher_id as string, { school_id: r.school_id as string, satir })
      }

      // Alıcı kümesi = tüm kaynakların birleşimi; school_id ilk bulunan kaynaktan.
      const teacherIds = new Set<string>([
        ...dersByTeacher.keys(), ...dutiesByTeacher.keys(), ...missingByMentor.keys(),
        ...hwByTeacher.keys(), ...meetingsByTeacher.keys(),
      ])

      const notifs: { user_id: string; school_id: string; title: string; body: string }[] = []
      const pushes: Promise<unknown>[] = []

      for (const tid of teacherIds) {
        const input: GunlukOzetInput = {
          dersSatiri: dersByTeacher.get(tid)?.satir ?? '',
          nobetSatirlari: dutiesByTeacher.get(tid)?.lines ?? [],
          eksikYoklamaSiniflari: (missingByMentor.get(tid) ?? []).map(x => x.name),
          bugunTeslimOdevler: (hwByTeacher.get(tid) ?? []).map(x => x.title),
          randevular: (meetingsByTeacher.get(tid) ?? []).map(x => ({ period: x.period, studentName: x.studentName })),
        }
        const ozet = formatGunlukOzet(input)
        if (!ozet) continue

        const schoolId =
          dersByTeacher.get(tid)?.school_id ?? dutiesByTeacher.get(tid)?.school_id ??
          missingByMentor.get(tid)?.[0]?.school_id ?? hwByTeacher.get(tid)?.[0]?.school_id ??
          meetingsByTeacher.get(tid)?.[0]?.school_id ?? ''
        if (!schoolId) continue

        notifs.push({ user_id: tid, school_id: schoolId, title: ozet.title, body: ozet.body })
        pushes.push(sendPushToUser(tid, { title: ozet.title, body: ozet.body, url: '/anasayfa' }))
      }

      if (notifs.length) await db.from('notifications').insert(notifs)
      const results = await Promise.allSettled(pushes)
      const failed = results.filter(x => x.status === 'rejected').length
      if (failed) logger.error({ event: 'gunluk_ozet_push_failed', failed }, 'Günlük özet push hatası')
      return notifs.length
    })

    return { sent }
  },
)
