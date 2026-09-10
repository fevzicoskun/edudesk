// Haftalık Çalışma Planı v2: her Pazar 18:00 (İstanbul) gelecek hafta planı olan öğrencilerin
// velilerine TEK "Haftaya çalışma planı hazır" e-postası (veli portal linkiyle). Öğe düzeyinde bildirim yok.
// Spec: docs/superpowers/specs/2026-09-09-haftalik-calisma-plani-design.md (## v2)
import { inngest } from '@/src/infrastructure/inngest'
import { turkeyDate } from '@/src/lib/email-utils'
import { nextWeekStart } from '@/src/domains/studyPlan/veliPlanMath'
import { VeliPlanService } from '@/src/domains/studyPlan/services/VeliPlanService'

export const planVeliNotifierFn = inngest.createFunction(
  {
    id: 'plan-veli-notifier',
    triggers: [{ cron: 'TZ=Europe/Istanbul 0 18 * * 0' }],
    concurrency: { limit: 1 }, // elle tetiklenen ikinci çalıştırma dedup kontrolüyle yarışmasın
  },
  async ({ step }) => {
    // Hafta step içinde hesaplanır (memoize): retry gece yarısını geçse de aynı hafta hedeflenir.
    const weekStart = await step.run('hedef-hafta', () => nextWeekStart(turkeyDate()))
    const result = await step.run('plan-veli-bildirimi', () =>
      VeliPlanService.notifyWeek(weekStart, process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'),
    )
    return { weekStart, ...result }
  },
)
