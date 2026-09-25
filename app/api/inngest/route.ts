import { serve } from 'inngest/next'
import { inngest } from '@/src/infrastructure/inngest'
import { homeworkReminderFn } from '@/src/domains/notifications/functions/homeworkReminder'
import { veliAbsenceNotifierFn } from '@/src/domains/notifications/functions/veliAbsenceNotifier'
import { aylikBultenFn } from '@/src/domains/notifications/functions/aylikBulten'
import { odevSonrasiVeliNotifierFn } from '@/src/domains/notifications/functions/odevSonrasiVeliNotifier'
import { homeworkCreatedNotifierFn } from '@/src/domains/notifications/functions/homeworkCreatedNotifier'
import { gunlukOzetFn } from '@/src/domains/notifications/functions/gunlukOzet'
import { planVeliNotifierFn } from '@/src/domains/notifications/functions/planVeliNotifier'
import { cronHataBildirimiFn } from '@/src/domains/notifications/functions/cronHataBildirimi'
import { haftalikYedekFn } from '@/src/domains/notifications/functions/haftalikYedek'

export const { GET, POST, PUT } = serve({
  client: inngest,
  // yoklamaHatirlaticiFn kapalı: yoklama arayüzden gizli (2026-09-25), hatırlatma gürültü olurdu
  functions: [homeworkReminderFn, veliAbsenceNotifierFn, aylikBultenFn, odevSonrasiVeliNotifierFn, homeworkCreatedNotifierFn, gunlukOzetFn, planVeliNotifierFn, cronHataBildirimiFn, haftalikYedekFn],
})
