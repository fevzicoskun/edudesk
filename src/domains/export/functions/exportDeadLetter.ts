import { inngest } from '@/src/infrastructure/inngest'
import { ExportRepository } from '../repositories/ExportRepository'
import { logger, securityLog } from '@/src/infrastructure/observability/logger'
import { withCorrelationId, newCorrelationId } from '@/src/infrastructure/observability/correlation'

export const exportDeadLetterFn = inngest.createFunction(
  { id: 'export-dead-letter', triggers: [{ event: 'inngest/function.failed' }] },
  async ({ event }) => {
    const { function_id, error, event: originalEvent } = event.data as {
      function_id: string
      error: { message: string; name: string }
      event: { data: { jobId?: string; userId?: string; schoolId?: string } }
    }

    if (function_id !== 'export-xlsx') return

    const jobId    = originalEvent?.data?.jobId
    const userId   = originalEvent?.data?.userId
    const schoolId = originalEvent?.data?.schoolId

    if (!jobId) return

    await withCorrelationId(newCorrelationId(), async () => {
      await ExportRepository.markDeadLetter(jobId, error?.message ?? 'Bilinmeyen hata')

      logger.error({
        job_id:    jobId,
        user_id:   userId,
        school_id: schoolId,
        error_name:    error?.name,
        error_message: error?.message,
        function_id,
      }, 'export job dead-lettered after max retries')

      securityLog('export.dead_letter', {
        user_id:   userId,
        school_id: schoolId,
        job_id:    jobId,
        reason:    error?.message,
      })
    })
  }
)
