// Pazartesi 07:00 haftalık özet maili: öğretmenin kendi sınıflarında takip edilecek öğrenciler,
// kontrol bekleyen ve bu hafta teslim alınacak ödevler. Boş özet gönderilmez; e-postası kapalı olana gitmez.
// Risk/ödev verisi ana sayfayla aynı kaynaktan (fetchRiskInputs + computeAlerts), servis istemcisiyle.
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'
import { logger } from '@/src/infrastructure/observability/logger'
import { fetchRiskInputs, computeAlerts } from '@/src/domains/dashboard/lib/riskEngine'
import { haftalikOzetMaili, HAFTALIK_OZET_BASLANGIC } from '../haftalikOzetMath'

const istDate = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)
const ROLLER = ['ogretmen', 'zumre_baskani']

export const haftalikOzetFn = inngest.createFunction(
  { id: 'haftalik-ozet', triggers: [{ cron: 'TZ=Europe/Istanbul 0 7 * * 1' }] },
  async ({ step }) => {
    const bugun = istDate(new Date())
    if (bugun < HAFTALIK_OZET_BASLANGIC) return { sent: 0, sebep: 'başlangıç tarihi gelmedi' }

    const alicilar = await step.run('alicilar', async () => {
      const db = createServiceClient()
      const { data: profiller, error } = await db.from('profiles').select('id, full_name, school_id').in('role', ROLLER).not('school_id', 'is', null)
      if (error) throw new Error(`Profiller okunamadı: ${error.message}`)
      const ids = (profiller ?? []).map(p => p.id)
      const { data: prefs, error: pe } = await db.from('notification_preferences').select('user_id, email_on').in('user_id', ids)
      if (pe) throw new Error(`Bildirim tercihleri okunamadı: ${pe.message}`)
      const kapali = new Set((prefs ?? []).filter(p => p.email_on === false).map(p => p.user_id))

      const eposta = new Map<string, string>()
      for (let page = 1; ; page++) {
        const { data, error: ue } = await db.auth.admin.listUsers({ perPage: 1000, page })
        if (ue) throw new Error(`Kullanıcılar okunamadı: ${ue.message}`)
        for (const u of data.users) if (u.email) eposta.set(u.id, u.email)
        if (data.users.length < 1000) break
      }
      // Tercihi kaydedilmemiş = e-posta açık (hatirlatmaAdaylari ile aynı varsayılan); test hesaplarına gitmez
      return (profiller ?? [])
        .filter(p => !kapali.has(p.id) && eposta.has(p.id) && !eposta.get(p.id)!.endsWith('@test.example'))
        .map(p => ({ id: p.id, ad: p.full_name, schoolId: p.school_id as string, eposta: eposta.get(p.id)! }))
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'
    let sent = 0
    // Öğretmen başına ayrı step: Inngest yeniden denemesinde gönderilmiş mail tekrar gitmez
    for (const a of alicilar) {
      const gitti = await step.run(`ozet-${a.id}`, async () => {
        const db = createServiceClient()
        const { homeworks, submissions, attendanceRows, students } = await fetchRiskInputs(a.id, a.schoolId, db)
        const mail = haftalikOzetMaili({
          ad: a.ad, bugun, baseUrl,
          riskler: computeAlerts(homeworks, submissions, attendanceRows, students),
          odevler: homeworks,
          kontrolEdilenIds: new Set(submissions.map(s => s.homework_id)),
        })
        if (!mail) return false
        try {
          await mailer.sendMail({ to: a.eposta, subject: mail.subject, html: mail.html })
          return true
        } catch (e) {
          logger.error({ event: 'haftalik_ozet_mail_failed', userId: a.id, err: (e as Error).message }, 'Haftalık özet maili gönderilemedi')
          return false
        }
      })
      if (gitti) sent++
    }
    return { sent, aday: alicilar.length }
  },
)
