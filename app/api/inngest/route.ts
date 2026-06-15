import { serve } from 'inngest/next'
import { inngest } from '@/src/infrastructure/inngest'
import { homeworkReminderFn } from '@/src/domains/notifications/functions/homeworkReminder'
import { veliAbsenceNotifierFn } from '@/src/domains/notifications/functions/veliAbsenceNotifier'
import { aylikBultenFn } from '@/src/domains/notifications/functions/aylikBulten'
import { odevSonrasiVeliNotifierFn } from '@/src/domains/notifications/functions/odevSonrasiVeliNotifier'
import { homeworkCreatedNotifierFn } from '@/src/domains/notifications/functions/homeworkCreatedNotifier'
import { yoklamaHatirlaticiFn } from '@/src/domains/notifications/functions/yoklamaHatirlatici'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [homeworkReminderFn, veliAbsenceNotifierFn, aylikBultenFn, odevSonrasiVeliNotifierFn, homeworkCreatedNotifierFn, yoklamaHatirlaticiFn],
})
