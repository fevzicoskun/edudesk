import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'

const YONETICI_ROLLER = ['mudur', 'mudur_yardimcisi']

export const yoklamaHatirlaticiFn = inngest.createFunction(
  { id: 'yoklama-hatirlatici', triggers: [{ cron: 'TZ=Europe/Istanbul 0 10 * * 1-5' }] },
  async ({ step }) => {
    const todayISO = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

    const missing = await step.run('eksik-siniflar', async () => {
      const db = createServiceClient()
      const { data: classes } = await db.from('classes')
        .select('id, name, school_id, mentor_teacher_id')
        .is('deleted_at', null)
        .not('school_id', 'is', null)
      if (!classes?.length) return []
      const schoolIds = [...new Set(classes.map(c => c.school_id as string))]
      const { data: attData } = await db.from('attendance')
        .select('class_id')
        .eq('date', todayISO)
        .in('school_id', schoolIds)
      const taken = new Set((attData ?? []).map(a => a.class_id))
      return classes.filter(c => !taken.has(c.id))
    })

    if (missing.length === 0) return { sent: 0 }

    await step.run('mentor-bildirimleri', async () => {
      const db = createServiceClient()
      const withMentor = missing.filter(c => c.mentor_teacher_id)
      if (withMentor.length === 0) return

      await db.from('notifications').insert(
        withMentor.map(c => ({
          user_id:   c.mentor_teacher_id!,
          school_id: c.school_id as string,
          title:     'Yoklama hatırlatması',
          body:      `${c.name} sınıfının bugünkü yoklaması henüz alınmadı.`,
        }))
      )

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

      const { data: managers } = await db
        .from('profiles')
        .select('id, school_id')
        .in('role', YONETICI_ROLLER)
        .in('school_id', [...bySchool.keys()])

      if (!managers?.length) return
      await db.from('notifications').insert(
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
    })

    return { sent: missing.length }
  }
)
