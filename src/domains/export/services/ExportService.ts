import { inngest } from '@/src/infrastructure/inngest'
import { ExportRepository } from '../repositories/ExportRepository'
import type { JobType } from '../types'

export const ExportService = {
  /**
   * Create a pending job record, then dispatch the Inngest event.
   * The event ID doubles as an idempotency key — sending the same
   * (jobId) twice will not enqueue a second run.
   */
  async enqueue(
    jobType: JobType,
    params: Record<string, string>,
    userId: string,
    schoolId: string
  ): Promise<{ jobId: string } | { error: string }> {
    // Stable idempotency key: one export job per user+type+params combination
    // per minute (prevents accidental double-clicks)
    const dedupeKey = `export-${userId}-${jobType}-${Math.floor(Date.now() / 60_000)}`

    // Check if an identical event was already enqueued this minute
    const { data: existing } = await ExportRepository.findByEventId(dedupeKey)
    if (existing) return { jobId: existing.id }

    const { data: job, error } = await ExportRepository.create({
      school_id: schoolId,
      user_id:   userId,
      job_type:  jobType,
      params,
      inngest_event_id: dedupeKey,
    })
    if (error || !job) return { error: error?.message ?? 'İş oluşturulamadı' }

    await inngest.send({
      id:   dedupeKey,               // Inngest-level idempotency
      name: 'export/requested',
      data: { jobId: job.id, jobType, params, userId, schoolId },
    })

    return { jobId: job.id }
  },

  /**
   * Send a cancellation event. Inngest will cancel the running function
   * if it hasn't completed yet; the dead-letter handler will not fire.
   */
  async cancel(jobId: string, cancelledBy: string): Promise<{ error?: string }> {
    const { data: job } = await ExportRepository.findById(jobId)
    if (!job) return { error: 'İş bulunamadı' }
    if (!['pending', 'processing'].includes(job.status)) {
      return { error: `İş zaten ${job.status} durumunda` }
    }

    // Mark cancelled in DB immediately so the UI updates fast
    await ExportRepository.markCancelled(jobId, cancelledBy)

    // Signal Inngest to cancel the in-flight run (if any)
    await inngest.send({
      name: 'export/cancelled',
      data: { jobId, cancelledBy },
    })

    return {}
  },
}
