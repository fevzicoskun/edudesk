/**
 * Export job queue backed by the export_jobs Supabase table.
 * Jobs are created synchronously; processing happens in the API route handler.
 */

import { createClient } from './supabase/server'
import { requireSchoolId, getCurrentUser } from './auth'
import { UUID } from './validation'

export type JobType = 'excel_odevler' | 'excel_yoklama' | 'excel_mufredat' | 'excel_notlar'
export type JobStatus = 'pending' | 'processing' | 'done' | 'error'

export interface ExportJob {
  id: string
  school_id: string
  user_id: string
  job_type: JobType
  status: JobStatus
  params: Record<string, string>
  result_url: string | null
  error_msg: string | null
  created_at: string
  updated_at: string
}

/** Create an export job and return its ID. */
export async function createExportJob(
  jobType: JobType,
  params: Record<string, string> = {}
): Promise<{ jobId: string } | { error: string }> {
  try {
    const [supabase, school_id, user] = await Promise.all([
      createClient(),
      requireSchoolId(),
      getCurrentUser(),
    ])
    if (!user) return { error: 'Giriş gerekli' }

    const { data, error } = await supabase
      .from('export_jobs')
      .insert({ school_id, user_id: user.id, job_type: jobType, params })
      .select('id')
      .single()

    if (error) return { error: error.message }
    return { jobId: data.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Bilinmeyen hata' }
  }
}

/** Poll job status. */
export async function getExportJob(
  jobId: string
): Promise<{ job: ExportJob } | { error: string }> {
  UUID.parse(jobId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('export_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !data) return { error: 'İş bulunamadı' }
  return { job: data as ExportJob }
}

/** List recent jobs for the current user. */
export async function listExportJobs(): Promise<ExportJob[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('export_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  return (data ?? []) as ExportJob[]
}
