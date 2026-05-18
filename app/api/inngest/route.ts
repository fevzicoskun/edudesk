import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { exportXlsxFn } from '@/src/domains/export/functions/exportXlsx'
import { exportDeadLetterFn } from '@/src/domains/export/functions/exportDeadLetter'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [exportXlsxFn, exportDeadLetterFn],
})
