import { logger } from '@/src/infrastructure/observability/logger'
import { createPublicToken } from '@/src/infrastructure/tokens'
import { mailer } from '@/src/lib/mailer'
import { unsubscribeUrl } from '@/src/lib/unsubscribeToken'
import { VeliPlanRepository } from '../repositories/VeliPlanRepository'
import {
  buildPlanHazirEmail, groupPortalWeeks, planVeliJti, portalWeekStarts,
  selectPlanNotifyTargets, toPlanStatus, type PortalWeek,
} from '../veliPlanMath'

const PAGE = 1000          // PostgREST varsayılan max-rows; sessiz truncation olmasın diye sayfalı okunur
const LINK_TTL_DAYS = 7    // Pazar 18:00 → sonraki Pazar 18:00: plan haftasını kapsar (manuel veli linkiyle aynı süre)

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < PAGE) return all
  }
}

// Veli tarafı (oturumsuz). Yetki = çağıranın doğruladığı veli token'ı / Inngest; bu yüzden ability yok.
export const VeliPlanService = {
  /** Veli portalı: bu hafta + gelecek hafta. Hata → bölüm gizlenir (portalın diğer bölümleri gibi fail-quiet). */
  async getPortalWeeks(studentId: string, schoolId: string | undefined, todayISO: string): Promise<PortalWeek[]> {
    const { data, error } = await VeliPlanRepository.listPortalItems(studentId, schoolId, portalWeekStarts(todayISO))
    if (error) {
      logger.error({ event: 'veli_plan_load_failed', err: error.message }, 'Veli portalı çalışma planı okunamadı')
      return []
    }
    return groupPortalWeeks((data ?? []).map(i => ({ ...i, status: toPlanStatus(i.status) })), todayISO)
  },

  /**
   * Pazar bildirimi: `weekStart` haftasında planı olan her öğrencinin velisine TEK e-posta.
   * İdempotensi: link kaydı (veli_tokens, jti = plan-<hafta>-<öğrenci>) gönderimden ÖNCE yazılır ve
   * sonraki çalıştırmalar bu kayıtları atlar. DB hataları throw → Inngest retry; kör gönderim yok.
   */
  async notifyWeek(weekStart: string, baseUrl: string): Promise<{ sent: number; failed: number }> {
    const rows = await fetchAll((from, to) => VeliPlanRepository.listWeekItemsPage(weekStart, from, to))
    if (!rows.length) return { sent: 0, failed: 0 }

    const notified = await fetchAll((from, to) => VeliPlanRepository.listNotifiedPage(weekStart, from, to))
    const targets = selectPlanNotifyTargets(rows, new Set(notified.map(n => n.student_id)))
    if (!targets.length) return { sent: 0, failed: 0 }

    // Mesajlar kayıttan önce kurulur: yapılandırma hatası (ör. UNSUBSCRIBE_SECRET) link yakmadan patlar.
    const messages = await Promise.all(targets.map(async t => {
      const jti = planVeliJti(weekStart, t.studentId)
      const token = await createPublicToken('veli', t.studentId, LINK_TTL_DAYS, { school_id: t.schoolId }, jti)
      const mail = buildPlanHazirEmail({
        veliAd: t.veliAd, ogrenciAdi: t.ogrenciAdi, weekStart,
        portalUrl: `${baseUrl}/veli/${token}`, unsubscribeUrl: unsubscribeUrl(t.studentId, baseUrl),
      })
      return { t, jti, mail }
    }))

    // Link kaydı: dedup işareti + öğretmen/yönetici "Devre Dışı Bırak" ile iptal edebilsin. Yazılamazsa gönderme.
    const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 86_400_000).toISOString()
    const { error } = await VeliPlanRepository.insertVeliTokens(messages.map(({ t, jti }) => ({
      student_id: t.studentId, school_id: t.schoolId, issued_by: t.teacherId, jti, expires_at: expiresAt,
    })))
    if (error) throw new Error(error.message)

    const results = await Promise.allSettled(messages.map(({ t, mail }) => mailer.sendMail({ to: t.to, ...mail })))
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed) {
      logger.error({ event: 'plan_veli_mail_failed', failed, total: messages.length, week_start: weekStart }, 'Plan hazır veli e-postaları gönderilemedi')
    }
    return { sent: messages.length - failed, failed }
  },
}
