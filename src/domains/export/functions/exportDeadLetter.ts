import { inngest } from '@/src/infrastructure/inngest'
import { ExportRepository } from '../repositories/ExportRepository'

export const exportDeadLetterFn = inngest.createFunction(
  { id: 'export-dead-letter', triggers: [{ event: 'inngest/function.failed' }] },
  async ({ event }) => {
    const { function_id, error, event: originalEvent } = event.data as {
      function_id: string
      error: { message: string; name: string }
      event: { data: { jobId?: string } }
    }

    if (function_id !== 'export-xlsx') return

    const jobId = originalEvent?.data?.jobId
    if (!jobId) return

    await ExportRepository.markDeadLetter(jobId, error?.message ?? 'Bilinmeyen hata')
  }
)
