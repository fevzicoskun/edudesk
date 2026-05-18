/**
 * Thin shell kept for backward-compatibility imports.
 * Real logic lives in src/domains/export/.
 */

import { getCurrentUser, requireSchoolId } from './auth'
import { ExportService } from '@/src/domains/export/services/ExportService'
import { ExportRepository } from '@/src/domains/export/repositories/ExportRepository'

export type JobType = 'excel_odevler' | 'excel_yoklama' | 'excel_mufredat' | 'excel_notlar'
export type JobStatus = 'pending' | 'processing' | 'done' | 'error' | 'cancelled' | 'dead_letter'

export interface ExportJob {
  id: string
  school_id: string
  user_id: string
  job_type: JobType
  status: JobStatus
  params: Record<string, string>
  result_url: string | null
  error_msg: string | null
  progress: number
  progress_step: string | null
  cancelled_at: string | null
  inngest_event_id: string | null
  dead_letter_reason: string | null
  attempt: number
  created_at: string
  updated_at: string
}

/** Enqueue an async export job via Inngest. */
export async function createExportJob(
  jobType: JobType,
  params: Record<string, string> = {}
): Promise<{ jobId: string } | { error: string }> {
  try {
    const [schoolId, user] = await Promise.all([requireSchoolId(), getCurrentUser()])
    if (!user) return { error: 'Giriş gerekli' }
    return ExportService.enqueue(jobType, params, user.id, schoolId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Bilinmeyen hata' }
  }
}

/** Poll job status. */
export async function getExportJob(
  jobId: string,
  userId?: string
): Promise<{ job: ExportJob } | { error: string }> {
  const { data, error } = await ExportRepository.findById(jobId, userId)
  if (error || !data) return { error: 'İş bulunamadı' }
  return { job: data as ExportJob }
}

/** List recent jobs for a user. */
export async function listExportJobs(userId: string): Promise<ExportJob[]> {
  const { data } = await ExportRepository.listByUser(userId)
  return (data ?? []) as ExportJob[]
}
