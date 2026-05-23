import { serve } from 'inngest/next'
import { inngest } from '@/src/infrastructure/inngest'
import { exportXlsxFn } from '@/src/domains/export/functions/exportXlsx'
import { exportDeadLetterFn } from '@/src/domains/export/functions/exportDeadLetter'
import { homeworkReminderFn } from '@/src/domains/notifications/functions/homeworkReminder'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [exportXlsxFn, exportDeadLetterFn, homeworkReminderFn],
})
