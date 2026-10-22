// Günlük Özet: hafta içi 07:30'da öğretmene tek sabah bildirimi
// (dersler + nöbet + dün eksik yoklama + bugün teslim ödev). Push/uygulama içi herkese;
// e-posta yalnız ödev/yoklama varsa (gunlukOzetMaili) — ödev başına hatırlatma mailinin yerini aldı.
// dersProgramiOzeti'nin evrimi. Spec: docs/superpowers/specs/2026-07-04-gunluk-ozet-design.md
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'
import { todaysLessons, formatOzetBody, type Period, type Slot } from '@/src/domains/schedule/scheduleMath'
import { formatDutyReminder } from '@/src/domains/schedule/dutyMath'
import { findMissingClasses } from './yoklamaHatirlatici'
import { formatGunlukOzet, gunlukOzetMaili, previousSchoolDayGap, type GunlukOzetInput } from '../gunlukOzetMath'
import { HAFTALIK_OZET_BASLANGIC } from '../haftalikOzetMath'
import { mailer } from '@/src/lib/mailer'
import { kapaliOkullar } from '@/src/domains/school/yoklamaAnahtari'

const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }
const istDate = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)

export const gunlukOzetFn = inngest.createFunction(
  { id: 'gunluk-ozet', triggers: [{ cron: 'TZ=Europe/Istanbul 30 7 * * 1-5' }] },
  async ({ step }) => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
    const today = DAY_MAP[wd]
    if (!today) return { sent: 0 } // hafta sonu güvenlik freni
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'

    const { sent, mailler } = await step.run('gunluk-ozetler', async () => {
      const db = createServiceClient()
      const todayISO = istDate(new Date())
      const dun = new Date()
      dun.setDate(dun.getDate() - previousSchoolDayGap(today))
      const dunISO = istDate(dun)
      const hafta = new Date()
      hafta.setDate(hafta.getDate() - 7)
      const haftaISO = istDate(hafta)

      // 5 toplu okul-geneli sorgu (RLS bypass). Fail-quiet: hatalı sorgunun bölümü boş kalır.
      const [schedules, classes, duties, attendance, homeworks] = await Promise.all([
        // Tüm okullar tek sorguda → max_rows=1000 aşılır (dünkü yoklama tek başına okul başına öğrenci sayısı kadar); sayfalı
        fetchAllResult((f, t) => db.from('lesson_schedules').select('teacher_id, school_id, slots, periods').not('teacher_id', 'is', null).order('id').range(f, t)),
        fetchAllResult((f, t) => db.from('classes').select('id, name, school_id, mentor_teacher_id').is('deleted_at', null).order('id').range(f, t)),
        fetchAllResult((f, t) => db.from('teacher_duties').select('teacher_id, school_id, day_of_week, time_range, location, notes').eq('day_of_week', today).order('id').range(f, t)),
        fetchAllResult((f, t) => db.from('attendance').select('class_id, school_id').eq('date', dunISO).order('id').range(f, t)),
        // Bugün teslim + son 7 günde teslimi geçmiş (işaretsizler sabah mailine)
        fetchAllResult((f, t) => db.from('homeworks').select('id, teacher_id, school_id, class_id, title, due_date').gte('due_date', haftaISO).lte('due_date', todayISO).is('deleted_at', null).order('id').range(f, t)),
      ])
      for (const [name, r] of Object.entries({ schedules, classes, duties, attendance, homeworks })) {
        if (r.error) logger.error({ event: 'gunluk_ozet_query_failed', query: name, err: r.error.message }, 'Günlük özet sorgusu başarısız')
      }

      const nameById = new Map((classes.data ?? []).map(c => [c.id as string, c.name as string]))

      // Bölüm: dün eksik yoklama (mentor sınıfları). Tatil koruması: okulda dün 0 kayıt → okul atlanır.
      const schoolsWithAttendance = new Set((attendance.data ?? []).map(a => a.school_id as string))
      // Yoklama modülü kapalı okulda "dün eksik yoklama" bölümü hiç yok
      const yoklamaKapali = await kapaliOkullar(db)
      const mentorClasses = (classes.data ?? []).filter(
        c => c.mentor_teacher_id && schoolsWithAttendance.has(c.school_id as string) && !yoklamaKapali.has(c.school_id as string),
      )
      const missingByMentor = new Map<string, { name: string; school_id: string }[]>()
      for (const c of findMissingClasses(mentorClasses as { id: string; name: string; school_id: string; mentor_teacher_id: string }[], (attendance.data ?? []) as { class_id: string; school_id: string }[])) {
        const list = missingByMentor.get(c.mentor_teacher_id) ?? []
        list.push({ name: c.name, school_id: c.school_id })
        missingByMentor.set(c.mentor_teacher_id, list)
      }

      // Bölüm: bugün teslim ödevler
      const hwByTeacher = new Map<string, { id: string; title: string; school_id: string; class_id: string }[]>()
      for (const h of (homeworks.data ?? []).filter(h => h.due_date === todayISO)) {
        const list = hwByTeacher.get(h.teacher_id) ?? []
        list.push({ id: h.id, title: h.title, school_id: h.school_id, class_id: h.class_id })
        hwByTeacher.set(h.teacher_id, list)
      }

      // Mail bölümü: teslimi geçmiş, hiç işaretlenmemiş ödevler (son 7 gün) + sınıf öğrenci sayıları.
      // marked_at şart: ödev açılınca tetikleyici her öğrenciye boş satır açar — satır var ≠ işaretlendi
      const gecmis = (homeworks.data ?? []).filter(h => h.due_date! < todayISO)
      const [subs, ogr] = await Promise.all([
        gecmis.length
          ? fetchAllResult((f, t) => db.from('homework_submissions').select('id, homework_id').not('marked_at', 'is', null).in('homework_id', gecmis.map(h => h.id)).order('id').range(f, t))
          : Promise.resolve({ data: [] as { homework_id: string }[], error: null }),
        fetchAllResult((f, t) => db.from('students').select('id, class_id').is('deleted_at', null).order('id').range(f, t)),
      ])
      if (subs.error || ogr.error) logger.error({ event: 'gunluk_ozet_query_failed', err: (subs.error ?? ogr.error)!.message }, 'Günlük özet mail sorgusu başarısız')
      const isaretli = new Set((subs.data ?? []).map(s => s.homework_id))
      // Sorgu hatasında hiçbir ödev yanlışlıkla "işaretlenmedi" diye listelenmesin
      const bekleyenByTeacher = new Map<string, { id: string; title: string; class_id: string; due_date: string }[]>()
      if (!subs.error) for (const h of gecmis.filter(h => !isaretli.has(h.id))) {
        const list = bekleyenByTeacher.get(h.teacher_id) ?? []
        list.push({ id: h.id, title: h.title, class_id: h.class_id, due_date: h.due_date! })
        bekleyenByTeacher.set(h.teacher_id, list)
      }
      const sinifMevcut = new Map<string, number>()
      for (const s of ogr.data ?? []) sinifMevcut.set(s.class_id, (sinifMevcut.get(s.class_id) ?? 0) + 1)

      // Bölüm: nöbetler
      const dutiesByTeacher = new Map<string, { school_id: string; lines: string[] }>()
      for (const d of duties.data ?? []) {
        const line = formatDutyReminder(d, today)
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
        ...hwByTeacher.keys(),
      ])

      const ozetVerisi = new Map<string, GunlukOzetInput>()
      const notifs: { user_id: string; school_id: string; title: string; body: string }[] = []
      const pushes: Promise<unknown>[] = []

      for (const tid of teacherIds) {
        const input: GunlukOzetInput = {
          dersSatiri: dersByTeacher.get(tid)?.satir ?? '',
          nobetSatirlari: dutiesByTeacher.get(tid)?.lines ?? [],
          eksikYoklamaSiniflari: (missingByMentor.get(tid) ?? []).map(x => x.name),
          bugunTeslimOdevler: (hwByTeacher.get(tid) ?? []).map(x => x.title),
        }
        ozetVerisi.set(tid, input)
        const ozet = formatGunlukOzet(input)
        if (!ozet) continue

        const schoolId =
          dersByTeacher.get(tid)?.school_id ?? dutiesByTeacher.get(tid)?.school_id ??
          missingByMentor.get(tid)?.[0]?.school_id ?? hwByTeacher.get(tid)?.[0]?.school_id ?? ''
        if (!schoolId) continue

        notifs.push({ user_id: tid, school_id: schoolId, title: ozet.title, body: ozet.body })
        pushes.push(sendPushToUser(tid, { title: ozet.title, body: ozet.body, url: '/anasayfa' }))
      }

      if (notifs.length) await db.from('notifications').insert(notifs)
      const results = await Promise.allSettled(pushes)
      const failed = results.filter(x => x.status === 'rejected').length
      if (failed) logger.error({ event: 'gunluk_ozet_push_failed', failed }, 'Günlük özet push hatası')

      // Sabah maili: alıcı kümesine yalnız işaretsiz ödevi olanlar da girer
      if (todayISO < HAFTALIK_OZET_BASLANGIC) return { sent: notifs.length, mailler: [] }
      const mailAday = [...new Set([...ozetVerisi.keys(), ...bekleyenByTeacher.keys()])]
      const [{ data: prof, error: profErr }, { data: prefs, error: prefErr }] = await Promise.all([
        db.from('profiles').select('id, full_name').in('id', mailAday),
        db.from('notification_preferences').select('user_id, email_on').in('user_id', mailAday),
      ])
      if (profErr || prefErr) throw new Error(`Mail alıcıları okunamadı: ${(profErr ?? prefErr)!.message}`)
      const kapali = new Set((prefs ?? []).filter(p => p.email_on === false).map(p => p.user_id))
      const eposta = new Map<string, string>()
      for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ perPage: 1000, page })
        if (error) throw new Error(`Kullanıcılar okunamadı: ${error.message}`)
        for (const u of data.users) if (u.email) eposta.set(u.id, u.email)
        if (data.users.length < 1000) break
      }
      const sinif = (id: string) => nameById.get(id) ?? '?'
      const mailler = (prof ?? []).flatMap(p => {
        const to = eposta.get(p.id)
        // Tercihi kaydedilmemiş = e-posta açık (hatirlatmaAdaylari ile aynı varsayılan); test hesaplarına gitmez
        if (!to || kapali.has(p.id) || to.endsWith('@test.example')) return []
        const o = ozetVerisi.get(p.id)
        const mail = gunlukOzetMaili({
          ad: p.full_name, baseUrl,
          dersSatiri: o?.dersSatiri ?? '', nobetSatirlari: o?.nobetSatirlari ?? [], eksikYoklamaSiniflari: o?.eksikYoklamaSiniflari ?? [],
          bugunTeslim: (hwByTeacher.get(p.id) ?? []).map(h => ({ id: h.id, title: h.title, sinif: sinif(h.class_id), ogrenci: sinifMevcut.get(h.class_id) ?? 0 })),
          bekleyen: (bekleyenByTeacher.get(p.id) ?? []).sort((a, b) => b.due_date.localeCompare(a.due_date))
            .map(h => ({ id: h.id, title: h.title, sinif: sinif(h.class_id), dueDate: h.due_date })),
        })
        return mail ? [{ id: p.id, to, ...mail }] : []
      })
      return { sent: notifs.length, mailler }
    })

    let mailed = 0
    // Öğretmen başına ayrı step: Inngest yeniden denemesinde gönderilmiş mail tekrar gitmez
    for (const m of mailler) {
      const gitti = await step.run(`mail-${m.id}`, async () => {
        try {
          await mailer.sendMail({ to: m.to, subject: m.subject, html: m.html })
          return true
        } catch (e) {
          logger.error({ event: 'gunluk_ozet_mail_failed', userId: m.id, err: (e as Error).message }, 'Sabah özeti maili gönderilemedi')
          return false
        }
      })
      if (gitti) mailed++
    }

    return { sent, mailed }
  },
)
