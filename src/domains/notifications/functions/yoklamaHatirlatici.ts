import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'
import { kapaliOkullar, yoklamasiAcik } from '@/src/domains/school/yoklamaAnahtari'

const YONETICI_ROLLER = ['mudur', 'mudur_yardimcisi']

/** Bugün yoklaması alınmamış sınıflar. Okulda bugün HİÇ yoklama yoksa o okul atlanır:
 *  resmî tatil (ör. 29 Ekim) ya da okulun yoklamayı EduDesk'te hiç kullanmaması — iki durumda da
 *  her sınıfa "yoklama alınmadı" demek yanlış alarm olur (gunlukOzet ile aynı koruma). */
export function findMissingClasses<T extends { id: string; school_id: string }>(
  classes: T[],
  attendanceTaken: { class_id: string; school_id: string }[]
): T[] {
  const taken = new Set(attendanceTaken.map(a => a.class_id))
  const aktifOkullar = new Set(attendanceTaken.map(a => a.school_id))
  return classes.filter(c => aktifOkullar.has(c.school_id) && !taken.has(c.id))
}

export const yoklamaHatirlaticiFn = inngest.createFunction(
  { id: 'yoklama-hatirlatici', triggers: [{ cron: 'TZ=Europe/Istanbul 0 10 * * 1-5' }] },
  async ({ step }) => {
    const todayISO = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

    const missing = await step.run('eksik-siniflar', async () => {
      const db = createServiceClient()
      // Tüm okullar: sayfalı (max_rows=1000'de kesilirse yoklamasını almış sınıfa "eksik" denir)
      const { data: classes, error: sinifHata } = await fetchAllResult((f, t) => db.from('classes')
        .select('id, name, school_id, mentor_teacher_id')
        .is('deleted_at', null)
        .not('school_id', 'is', null)
        .order('id')
        .range(f, t))
      // Okuma hatası = throw (Inngest yeniden dener, cronHataBildirimi kaydeder); eskiden "eksik yok" sayılıyordu
      if (sinifHata) throw new Error(`Sınıflar okunamadı: ${sinifHata.message}`)
      // Yoklama modülü kapalı okullar hiç işlenmez (tek sınıfın yanlışlıkla girilen yoklaması diğerlerini "eksik" yapmasın)
      const acikSiniflar = yoklamasiAcik(classes as { id: string; name: string; school_id: string; mentor_teacher_id: string | null }[], await kapaliOkullar(db))
      if (!acikSiniflar.length) return []
      const schoolIds = [...new Set(acikSiniflar.map(c => c.school_id))]
      const { data: attData, error: yoklamaHata } = await fetchAllResult((f, t) => db.from('attendance')
        .select('class_id, school_id')
        .eq('date', todayISO)
        .in('school_id', schoolIds)
        .order('id')
        .range(f, t))
      // Eskiden hata → attData boş → TÜM sınıflar "eksik" → herkese yanlış hatırlatma
      if (yoklamaHata) throw new Error(`Yoklamalar okunamadı: ${yoklamaHata.message}`)
      return findMissingClasses(
        acikSiniflar,
        (attData ?? []) as { class_id: string; school_id: string }[],
      )
    })

    if (missing.length === 0) return { sent: 0 }

    await step.run('mentor-bildirimleri', async () => {
      const db = createServiceClient()
      const withMentor = missing.filter(c => c.mentor_teacher_id)
      if (withMentor.length === 0) return

      const { error: bildirimHata } = await db.from('notifications').insert(
        withMentor.map(c => ({
          user_id:   c.mentor_teacher_id!,
          school_id: c.school_id as string,
          title:     'Yoklama hatırlatması',
          body:      `${c.name} sınıfının bugünkü yoklaması henüz alınmadı.`,
        }))
      )
      if (bildirimHata) throw new Error(`Rehber öğretmen bildirimi yazılamadı: ${bildirimHata.message}`)

      const results = await Promise.allSettled(
        withMentor.map(c =>
          sendPushToUser(c.mentor_teacher_id!, {
            title: 'Yoklama hatırlatması',
            body:  `${c.name} yoklaması henüz alınmadı.`,
            url:   `/yoklama?sinif=${c.id}`,
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed) {
        logger.error({ event: 'yoklama_hatirlatici_push_failed', failed }, 'Yoklama hatırlatma push hatası')
      }
    })

    await step.run('idare-ozeti', async () => {
      const db = createServiceClient()
      const bySchool = new Map<string, string[]>()
      for (const c of missing) {
        bySchool.set(c.school_id, [...(bySchool.get(c.school_id) ?? []), c.name])
      }

      const { data: managers, error: yoneticiHata } = await db
        .from('profiles')
        .select('id, school_id')
        .in('role', YONETICI_ROLLER)
        .in('school_id', [...bySchool.keys()])

      if (yoneticiHata) throw new Error(`Yöneticiler okunamadı: ${yoneticiHata.message}`)
      if (!managers?.length) return
      const { error: ozetHata } = await db.from('notifications').insert(
        managers.filter(m => m.school_id).map(m => {
          const names = bySchool.get(m.school_id!) ?? []
          return {
            user_id:   m.id,
            school_id: m.school_id as string,
            title:     'Eksik yoklamalar',
            body:      `${names.length} sınıfın yoklaması alınmadı: ${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''}`,
          }
        })
      )
      if (ozetHata) throw new Error(`İdare özeti yazılamadı: ${ozetHata.message}`)
    })

    return { sent: missing.length }
  }
)
