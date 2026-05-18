import { createServiceClient } from '@/lib/supabase/service'
import type { ExportJob, JobStatus } from '../types'

export const ExportRepository = {
  async create(data: {
    school_id: string
    user_id: string
    job_type: string
    params: Record<string, string>
    inngest_event_id: string
  }) {
    const db = createServiceClient()
    return db
      .from('export_jobs')
      .insert({ ...data, status: 'pending', progress: 0, attempt: 1 })
      .select('id')
      .single()
  },

  async updateStatus(jobId: string, status: JobStatus, extra: Record<string, unknown> = {}) {
    const db = createServiceClient()
    return db
      .from('export_jobs')
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq('id', jobId)
  },

  async updateProgress(jobId: string, progress: number, step: string) {
    const db = createServiceClient()
    return db
      .from('export_jobs')
      .update({ progress, progress_step: step, updated_at: new Date().toISOString() })
      .eq('id', jobId)
  },

  async markProcessing(jobId: string, attempt: number) {
    return ExportRepository.updateStatus(jobId, 'processing', { attempt, progress: 0 })
  },

  async markDone(jobId: string, resultUrl: string, filename: string) {
    return ExportRepository.updateStatus(jobId, 'done', {
      result_url: resultUrl,
      progress: 100,
      progress_step: `Hazır: ${filename}`,
    })
  },

  async markError(jobId: string, message: string) {
    return ExportRepository.updateStatus(jobId, 'error', { error_msg: message })
  },

  async markCancelled(jobId: string, cancelledBy: string) {
    return ExportRepository.updateStatus(jobId, 'cancelled', {
      cancelled_at: new Date().toISOString(),
      progress_step: `İptal eden: ${cancelledBy}`,
    })
  },

  async markDeadLetter(jobId: string, reason: string) {
    return ExportRepository.updateStatus(jobId, 'dead_letter', { dead_letter_reason: reason })
  },

  async findById(jobId: string, userId?: string) {
    const db = createServiceClient()
    let q = db.from('export_jobs').select('*').eq('id', jobId)
    if (userId) q = q.eq('user_id', userId)
    return q.single()
  },

  async findByEventId(inngestEventId: string) {
    const db = createServiceClient()
    return db
      .from('export_jobs')
      .select('id')
      .eq('inngest_event_id', inngestEventId)
      .maybeSingle()
  },

  async listByUser(userId: string, limit = 20) {
    const db = createServiceClient()
    return db
      .from('export_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
  },
}
